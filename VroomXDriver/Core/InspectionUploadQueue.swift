import Foundation
import Supabase

/// Status of an upload item in the inspection media queue.
enum UploadStatus: String, Codable {
    case pending
    case uploading
    case failed
}

/// Media kind for inspection uploads.
enum MediaKind: String, Codable {
    case photo
    case video
}

/// An item in the inspection media upload queue.
struct UploadItem: Codable, Identifiable {
    let id: String
    let inspectionId: String
    let mediaKind: MediaKind
    let slotKey: String
    let localPath: String
    let mimeType: String
    let byteSize: Int
    var attempts: Int
    var status: UploadStatus
    var lastError: String?
    var nextRetryAt: Date?
}

/// Thread-safe queue for uploading inspection media (photos/videos) to Supabase Storage.
/// Uses exponential backoff on failure: 5s, 10s, 20s, 40s, 80s... capped at 15 minutes.
actor InspectionUploadQueue {
    /// Shared singleton instance.
    static let shared = InspectionUploadQueue()

    /// UserDefaults key for persisted queue.
    private let storageKey = "vroomx_upload_queue"

    /// Maximum backoff interval in seconds (15 minutes).
    private let maxBackoffSeconds: TimeInterval = 900

    /// Base backoff interval in seconds.
    private let baseBackoffSeconds: TimeInterval = 5

    private var queue: [UploadItem] = []
    private var isProcessing = false

    private init() {
        queue = loadFromStorage()
    }

    // MARK: - Public API

    /// Add a media item to the upload queue.
    func enqueue(_ item: UploadItem) {
        queue.append(item)
        saveToStorage()
        print("[UploadQueue] Enqueued \(item.mediaKind.rawValue) for inspection \(item.inspectionId) (queue size: \(queue.count))")

        // Start processing if not already running
        if !isProcessing {
            Task {
                await processLoop()
            }
        }
    }

    /// Process the next ready item in the queue.
    /// Called in a loop until the queue is empty or all items are waiting for retry.
    func processNext() async {
        let now = Date()

        // Find the next item that is ready to process
        guard let index = queue.firstIndex(where: { item in
            item.status == .pending || (item.status == .failed && (item.nextRetryAt ?? .distantPast) <= now)
        }) else {
            return
        }

        var item = queue[index]
        item.status = .uploading
        queue[index] = item
        saveToStorage()

        do {
            try await uploadItem(item)

            // Remove from queue on success
            queue.remove(at: index)
            saveToStorage()
            print("[UploadQueue] Uploaded \(item.mediaKind.rawValue) \(item.slotKey) for inspection \(item.inspectionId)")
        } catch {
            // Apply exponential backoff
            item.status = .failed
            item.attempts += 1
            item.lastError = error.localizedDescription
            item.nextRetryAt = Date().addingTimeInterval(backoffInterval(forAttempt: item.attempts))

            // Update in queue (index might have shifted if other items were removed)
            if let currentIndex = queue.firstIndex(where: { $0.id == item.id }) {
                queue[currentIndex] = item
            }
            saveToStorage()

            let delay = backoffInterval(forAttempt: item.attempts)
            print("[UploadQueue] Failed attempt \(item.attempts) for \(item.slotKey): \(error). Retry in \(Int(delay))s")
        }
    }

    /// Remove all items from the queue. Called on logout.
    func clearQueue() {
        queue = []
        isProcessing = false
        saveToStorage()
        print("[UploadQueue] Queue cleared")
    }

    /// Current number of items in the queue.
    var count: Int {
        queue.count
    }

    /// All items currently in the queue (for UI display).
    var items: [UploadItem] {
        queue
    }

    // MARK: - Processing Loop

    /// Continuously process items until the queue is empty or all items are waiting for retry.
    private func processLoop() async {
        guard !isProcessing else { return }
        isProcessing = true
        defer { isProcessing = false }

        while !queue.isEmpty {
            let now = Date()

            // Check if any items are ready
            let hasReadyItem = queue.contains { item in
                item.status == .pending || (item.status == .failed && (item.nextRetryAt ?? .distantPast) <= now)
            }

            if hasReadyItem {
                await processNext()
            } else {
                // Find the nearest retry time
                let nearestRetry = queue.compactMap(\.nextRetryAt).min()
                if let retryAt = nearestRetry {
                    let delay = max(retryAt.timeIntervalSinceNow, 1)
                    try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                } else {
                    break
                }
            }
        }
    }

    // MARK: - Upload

    /// Upload a single item to Supabase Storage and update the corresponding database record.
    private func uploadItem(_ item: UploadItem) async throws {
        let supabase = SupabaseManager.shared.client

        // Read the local file
        let fileURL = URL(fileURLWithPath: item.localPath)
        let fileData = try Data(contentsOf: fileURL)

        // Build storage path: {inspectionId}/{photos|videos}/{slotKey}.{ext}
        let mediaFolder = item.mediaKind == .photo ? "photos" : "videos"
        let fileExtension = item.mimeType.contains("mp4") ? "mp4"
            : item.mimeType.contains("mov") ? "mov"
            : "jpg"
        let storagePath = "\(item.inspectionId)/\(mediaFolder)/\(item.slotKey).\(fileExtension)"

        // Upload to Supabase Storage
        try await supabase.storage
            .from(Config.inspectionMediaBucket)
            .upload(
                storagePath,
                data: fileData,
                options: FileOptions(contentType: item.mimeType, upsert: true)
            )

        // Update the database record with the storage path
        switch item.mediaKind {
        case .photo:
            try await supabase
                .from("inspection_photos")
                .update([
                    "storage_path": AnyJSON.string(storagePath),
                    "upload_status": AnyJSON.string("completed")
                ])
                .eq("inspection_id", value: item.inspectionId)
                .eq("photo_type", value: item.slotKey)
                .execute()

        case .video:
            try await supabase
                .from("inspection_videos")
                .update([
                    "storage_path": AnyJSON.string(storagePath),
                    "upload_status": AnyJSON.string("completed")
                ])
                .eq("inspection_id", value: item.inspectionId)
                .execute()
        }
    }

    // MARK: - Backoff

    /// Calculate exponential backoff interval: 5s * 2^(attempt-1), capped at 15 minutes.
    private func backoffInterval(forAttempt attempt: Int) -> TimeInterval {
        let interval = baseBackoffSeconds * pow(2.0, Double(attempt - 1))
        return min(interval, maxBackoffSeconds)
    }

    // MARK: - Persistence

    /// Save the current queue to UserDefaults.
    private func saveToStorage() {
        do {
            let data = try JSONEncoder().encode(queue)
            UserDefaults.standard.set(data, forKey: storageKey)
        } catch {
            print("[UploadQueue] Failed to save queue: \(error)")
        }
    }

    /// Load the queue from UserDefaults.
    private func loadFromStorage() -> [UploadItem] {
        guard let data = UserDefaults.standard.data(forKey: storageKey) else {
            return []
        }
        do {
            return try JSONDecoder().decode([UploadItem].self, from: data)
        } catch {
            print("[UploadQueue] Failed to load queue: \(error)")
            return []
        }
    }
}
