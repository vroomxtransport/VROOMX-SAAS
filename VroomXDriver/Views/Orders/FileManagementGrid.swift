import SwiftUI
import PhotosUI
import Supabase

/// 2-column grid displaying order attachments (BOLs, photos, documents).
/// Fetches from `order_attachments` table. Upload queued via InspectionUploadQueue
/// for offline resilience and background processing to `bol-documents` bucket.
struct FileManagementGrid: View {
    let orderId: String

    @State private var attachments: [OrderAttachment] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var showingPhotoPicker = false
    @State private var selectedAttachment: OrderAttachment?
    @State private var showingPreview = false

    /// Tracks upload status for locally-queued files by their local ID.
    @State private var pendingUploads: [PendingUpload] = []

    private let columns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12)
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if isLoading {
                ProgressView()
                    .progressViewStyle(.circular)
                    .tint(.brandPrimary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 20)
            } else if attachments.isEmpty && pendingUploads.isEmpty {
                emptyState
            } else {
                LazyVGrid(columns: columns, spacing: 12) {
                    // Existing attachments
                    ForEach(attachments) { attachment in
                        FileCard(attachment: attachment)
                            .onTapGesture {
                                selectedAttachment = attachment
                                showingPreview = true
                            }
                    }

                    // Pending uploads
                    ForEach(pendingUploads) { upload in
                        PendingUploadCard(upload: upload)
                    }

                    // Add file button
                    addFileButton
                }
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(.vroomxCaption)
                    .foregroundColor(.brandDanger)
            }
        }
        .task {
            await fetchAttachments()
        }
        .photosPicker(
            isPresented: $showingPhotoPicker,
            selection: $selectedPhoto,
            matching: .images
        )
        .onChange(of: selectedPhoto) { _, newValue in
            if let item = newValue {
                Task {
                    await handlePhotoSelection(item)
                }
                selectedPhoto = nil
            }
        }
        .sheet(isPresented: $showingPreview) {
            if let attachment = selectedAttachment {
                AttachmentPreviewSheet(attachment: attachment)
            }
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "plus.rectangle.on.folder")
                .font(.system(size: 28))
                .foregroundColor(.textSecondary.opacity(0.5))

            Text("No files attached")
                .font(.vroomxBody)
                .foregroundColor(.textSecondary)

            Button {
                showingPhotoPicker = true
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "plus")
                        .font(.system(size: 12, weight: .bold))
                    Text("Add Photo")
                        .font(.vroomxCaption)
                }
                .foregroundColor(.brandPrimary)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(Color.brandPrimary.opacity(0.1))
                .cornerRadius(8)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
    }

    // MARK: - Add File Button

    private var addFileButton: some View {
        Button {
            showingPhotoPicker = true
        } label: {
            VStack(spacing: 8) {
                Image(systemName: "plus.circle.fill")
                    .font(.system(size: 24))
                    .foregroundColor(.brandPrimary)

                Text("Add File")
                    .font(.vroomxCaption)
                    .foregroundColor(.brandPrimary)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 100)
            .background(Color.brandPrimary.opacity(0.05))
            .cornerRadius(10)
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .strokeBorder(Color.brandPrimary.opacity(0.3), style: StrokeStyle(lineWidth: 1, dash: [6]))
            )
        }
    }

    // MARK: - Fetch Attachments

    private func fetchAttachments() async {
        isLoading = true
        errorMessage = nil

        do {
            let result: [OrderAttachment] = try await SupabaseManager.shared.client
                .from("order_attachments")
                .select()
                .eq("order_id", value: orderId)
                .order("created_at", ascending: false)
                .execute()
                .value

            await MainActor.run {
                attachments = result
                isLoading = false
            }
        } catch {
            await MainActor.run {
                isLoading = false
                errorMessage = "Failed to load files"
                print("[FileManagementGrid] fetchAttachments failed: \(error)")
            }
        }
    }

    // MARK: - Photo Selection Handler

    private func handlePhotoSelection(_ item: PhotosPickerItem) async {
        guard let data = try? await item.loadTransferable(type: Data.self) else {
            await MainActor.run {
                errorMessage = "Failed to load selected photo"
            }
            return
        }

        let uploadId = UUID().uuidString
        let fileName = "order_\(orderId)_\(uploadId).jpg"

        // Save to local temp directory
        let tempDir = FileManager.default.temporaryDirectory
        let localURL = tempDir.appendingPathComponent(fileName)

        do {
            try data.write(to: localURL)
        } catch {
            await MainActor.run {
                errorMessage = "Failed to save photo locally"
            }
            return
        }

        // Add to pending uploads UI
        let pending = PendingUpload(
            id: uploadId,
            fileName: fileName,
            status: .uploading,
            localPath: localURL.path
        )

        await MainActor.run {
            pendingUploads.append(pending)
        }

        // Queue upload via InspectionUploadQueue for offline resilience
        // Using mediaKind='photo' and slotKey='attachment' with the bol-documents bucket
        let uploadItem = UploadItem(
            id: uploadId,
            inspectionId: orderId, // Re-use inspectionId field for orderId
            mediaKind: .photo,
            slotKey: "attachment_\(uploadId)",
            localPath: localURL.path,
            mimeType: "image/jpeg",
            byteSize: data.count,
            attempts: 0,
            status: .pending,
            lastError: nil,
            nextRetryAt: nil
        )

        await InspectionUploadQueue.shared.enqueue(uploadItem)

        // Also try direct upload to create the order_attachments record
        await uploadAndCreateRecord(
            uploadId: uploadId,
            fileName: fileName,
            data: data,
            localPath: localURL.path
        )
    }

    // MARK: - Direct Upload + Record Creation

    private func uploadAndCreateRecord(
        uploadId: String,
        fileName: String,
        data: Data,
        localPath: String
    ) async {
        let storagePath = "\(orderId)/\(fileName)"
        let supabase = SupabaseManager.shared.client

        do {
            // Upload to bol-documents bucket
            try await supabase.storage
                .from(Config.bolDocumentsBucket)
                .upload(
                    storagePath,
                    data: data,
                    options: FileOptions(contentType: "image/jpeg", upsert: true)
                )

            // Create order_attachments record
            let record = OrderAttachmentInsert(
                orderId: orderId,
                fileName: fileName,
                fileType: "photo",
                storagePath: storagePath,
                fileSize: data.count,
                mimeType: "image/jpeg"
            )

            try await supabase
                .from("order_attachments")
                .insert(record)
                .execute()

            // Update UI: remove from pending, refresh attachments
            await MainActor.run {
                pendingUploads.removeAll { $0.id == uploadId }
            }
            await fetchAttachments()

        } catch {
            // Mark as failed in pending uploads (queue will retry via InspectionUploadQueue)
            await MainActor.run {
                if let index = pendingUploads.firstIndex(where: { $0.id == uploadId }) {
                    pendingUploads[index].status = .failed
                }
            }
            print("[FileManagementGrid] Upload failed (queued for retry): \(error)")
        }
    }
}

// MARK: - Order Attachment Model

/// Represents a file attached to an order in the `order_attachments` table.
struct OrderAttachment: Codable, Identifiable {
    let id: String
    let orderId: String
    let fileName: String
    let fileType: String?
    let storagePath: String
    let fileSize: Int?
    let mimeType: String?
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case orderId = "order_id"
        case fileName = "file_name"
        case fileType = "file_type"
        case storagePath = "storage_path"
        case fileSize = "file_size"
        case mimeType = "mime_type"
        case createdAt = "created_at"
    }
}

/// Insert payload for creating order_attachments records.
struct OrderAttachmentInsert: Codable {
    let orderId: String
    let fileName: String
    let fileType: String
    let storagePath: String
    let fileSize: Int
    let mimeType: String

    enum CodingKeys: String, CodingKey {
        case orderId = "order_id"
        case fileName = "file_name"
        case fileType = "file_type"
        case storagePath = "storage_path"
        case fileSize = "file_size"
        case mimeType = "mime_type"
    }
}

// MARK: - Pending Upload Model

/// Tracks a locally-queued upload that hasn't completed yet.
struct PendingUpload: Identifiable {
    let id: String
    let fileName: String
    var status: PendingUploadStatus
    let localPath: String
}

enum PendingUploadStatus {
    case uploading
    case failed
}

// MARK: - File Card

/// Card displaying a single file attachment with icon, name, and size.
private struct FileCard: View {
    let attachment: OrderAttachment

    var body: some View {
        VStack(spacing: 8) {
            // File type icon
            Image(systemName: fileIcon)
                .font(.system(size: 28))
                .foregroundColor(iconColor)
                .frame(height: 36)

            // File name (truncated)
            Text(attachment.fileName)
                .font(.vroomxCaption)
                .foregroundColor(.textPrimary)
                .lineLimit(2)
                .multilineTextAlignment(.center)

            // File size
            if let size = attachment.fileSize {
                Text(formatFileSize(size))
                    .font(.vroomxCaptionSmall)
                    .foregroundColor(.textSecondary)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(12)
        .background(Color.appBackground)
        .cornerRadius(10)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Color.textSecondary.opacity(0.15), lineWidth: 1)
        )
    }

    private var fileIcon: String {
        guard let fileType = attachment.fileType?.lowercased() else {
            return "doc.fill"
        }

        switch fileType {
        case "bol_pdf", "pdf": return "doc.richtext.fill"
        case "receipt": return "receipt"
        case "photo", "image": return "photo.fill"
        case "document", "doc": return "doc.fill"
        default: return "doc.fill"
        }
    }

    private var iconColor: Color {
        guard let fileType = attachment.fileType?.lowercased() else {
            return .textSecondary
        }

        switch fileType {
        case "bol_pdf", "pdf": return .brandDanger
        case "receipt": return .brandWarning
        case "photo", "image": return .brandPrimary
        case "document", "doc": return .brandAccent
        default: return .textSecondary
        }
    }

    private func formatFileSize(_ bytes: Int) -> String {
        let kb = Double(bytes) / 1024
        if kb < 1024 {
            return String(format: "%.0f KB", kb)
        }
        let mb = kb / 1024
        return String(format: "%.1f MB", mb)
    }
}

// MARK: - Pending Upload Card

/// Card showing upload progress or failure status for a pending file.
private struct PendingUploadCard: View {
    let upload: PendingUpload

    var body: some View {
        VStack(spacing: 8) {
            ZStack {
                Image(systemName: "photo.fill")
                    .font(.system(size: 28))
                    .foregroundColor(.textSecondary.opacity(0.5))
                    .frame(height: 36)

                switch upload.status {
                case .uploading:
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(.brandPrimary)
                        .scaleEffect(0.8)
                case .failed:
                    Image(systemName: "exclamationmark.circle.fill")
                        .font(.system(size: 16))
                        .foregroundColor(.brandDanger)
                        .offset(x: 12, y: 12)
                }
            }

            Text(upload.fileName)
                .font(.vroomxCaption)
                .foregroundColor(.textPrimary)
                .lineLimit(2)
                .multilineTextAlignment(.center)

            Text(upload.status == .uploading ? "Uploading..." : "Failed")
                .font(.vroomxCaptionSmall)
                .foregroundColor(upload.status == .uploading ? .brandPrimary : .brandDanger)
        }
        .frame(maxWidth: .infinity)
        .padding(12)
        .background(Color.appBackground)
        .cornerRadius(10)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(
                    upload.status == .uploading ? Color.brandPrimary.opacity(0.3) : Color.brandDanger.opacity(0.3),
                    lineWidth: 1
                )
        )
    }
}

// MARK: - Attachment Preview Sheet

/// Full-screen sheet for previewing an attachment (photos displayed as AsyncImage).
private struct AttachmentPreviewSheet: View {
    let attachment: OrderAttachment
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()

                if isImage {
                    // Load image from Supabase Storage
                    AsyncImage(url: storageURL) { phase in
                        switch phase {
                        case .empty:
                            ProgressView()
                                .progressViewStyle(.circular)
                                .tint(.white)
                        case .success(let image):
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fit)
                        case .failure:
                            VStack(spacing: 12) {
                                Image(systemName: "photo.badge.exclamationmark")
                                    .font(.system(size: 36))
                                    .foregroundColor(.white.opacity(0.5))
                                Text("Failed to load image")
                                    .font(.vroomxBody)
                                    .foregroundColor(.white.opacity(0.7))
                            }
                        @unknown default:
                            EmptyView()
                        }
                    }
                } else {
                    // Non-image file preview
                    VStack(spacing: 16) {
                        Image(systemName: "doc.fill")
                            .font(.system(size: 48))
                            .foregroundColor(.white.opacity(0.6))

                        Text(attachment.fileName)
                            .font(.vroomxTitle)
                            .foregroundColor(.white)
                            .multilineTextAlignment(.center)

                        if let fileType = attachment.fileType {
                            Text(fileType.uppercased())
                                .font(.vroomxCaption)
                                .foregroundColor(.white.opacity(0.6))
                        }
                    }
                }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 24))
                            .foregroundColor(.white.opacity(0.8))
                    }
                }
            }
        }
    }

    private var isImage: Bool {
        let imageTypes = ["photo", "image"]
        if let fileType = attachment.fileType?.lowercased(), imageTypes.contains(fileType) {
            return true
        }
        if let mimeType = attachment.mimeType?.lowercased(), mimeType.hasPrefix("image/") {
            return true
        }
        return false
    }

    private var storageURL: URL? {
        // Build public URL from Supabase Storage
        let baseURL = Config.supabaseURL
        let path = attachment.storagePath
        return URL(string: "\(baseURL)/storage/v1/object/public/\(Config.bolDocumentsBucket)/\(path)")
    }
}

#Preview {
    FileManagementGrid(orderId: "test-order-1")
        .padding()
        .background(Color.cardBackground)
}
