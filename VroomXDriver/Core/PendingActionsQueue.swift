import Foundation
import Supabase

/// A pending mutation action queued while offline.
/// Persisted to UserDefaults so it survives app restarts.
struct PendingAction: Codable, Identifiable {
    let id: UUID
    let actionType: String
    let payload: Data
    let createdAt: Date
    var attempts: Int
    var lastError: String?
}

/// Thread-safe queue for offline mutations.
/// Persists to UserDefaults and auto-processes when network reconnects.
actor PendingActionsQueue {
    /// Shared singleton instance.
    static let shared = PendingActionsQueue()

    /// Maximum retry attempts before an action is considered permanently failed.
    private let maxRetries = 5

    /// UserDefaults key for persisted queue.
    private let storageKey = "vroomx_pending_actions"

    private var queue: [PendingAction] = []
    private var isProcessing = false

    private init() {
        queue = loadFromStorage()
    }

    // MARK: - Public API

    /// Add a mutation action to the queue and persist.
    func enqueue(_ action: PendingAction) {
        queue.append(action)
        saveToStorage()
        print("[PendingActionsQueue] Enqueued action: \(action.actionType) (queue size: \(queue.count))")
    }

    /// Process all pending actions in order.
    /// Removes successful actions, increments attempts on failure.
    /// Actions exceeding maxRetries are removed with an error log.
    func processQueue() async {
        guard !isProcessing else { return }
        guard !queue.isEmpty else { return }

        isProcessing = true
        defer { isProcessing = false }

        print("[PendingActionsQueue] Processing \(queue.count) pending actions...")

        var remainingActions: [PendingAction] = []

        for var action in queue {
            do {
                try await executeAction(action)
                print("[PendingActionsQueue] Completed: \(action.actionType)")
            } catch {
                action.attempts += 1
                action.lastError = error.localizedDescription

                if action.attempts >= maxRetries {
                    print("[PendingActionsQueue] Permanently failed after \(maxRetries) attempts: \(action.actionType) - \(error)")
                } else {
                    print("[PendingActionsQueue] Retry \(action.attempts)/\(maxRetries) for \(action.actionType): \(error)")
                    remainingActions.append(action)
                }
            }
        }

        queue = remainingActions
        saveToStorage()
    }

    /// Remove all pending actions. Called on logout.
    func clearQueue() {
        queue = []
        saveToStorage()
        print("[PendingActionsQueue] Queue cleared")
    }

    /// Current number of pending actions.
    var count: Int {
        queue.count
    }

    // MARK: - Action Execution

    /// Execute a single pending action via the Supabase client.
    private func executeAction(_ action: PendingAction) async throws {
        let supabase = SupabaseManager.shared.client
        let decoder = JSONDecoder()

        switch action.actionType {
        case "updateOrderStatus":
            let payload = try decoder.decode(OrderStatusPayload.self, from: action.payload)
            var updates: [String: AnyJSON] = [
                "status": .string(payload.status.rawValue),
                "updated_at": .string(ISO8601DateFormatter().string(from: Date()))
            ]
            switch payload.status {
            case .picked_up:
                updates["actual_pickup_date"] = .string(ISO8601DateFormatter().string(from: Date()))
            case .delivered:
                updates["actual_delivery_date"] = .string(ISO8601DateFormatter().string(from: Date()))
            default:
                break
            }
            try await supabase
                .from("orders")
                .update(updates)
                .eq("id", value: payload.orderId)
                .execute()

        case "submitETA":
            let payload = try decoder.decode(ETAPayload.self, from: action.payload)
            let formatter = ISO8601DateFormatter()
            var updates: [String: AnyJSON] = [
                "updated_at": .string(formatter.string(from: Date()))
            ]
            if let pickupETA = payload.pickupETA {
                updates["pickup_eta"] = .string(formatter.string(from: pickupETA))
            }
            if let deliveryETA = payload.deliveryETA {
                updates["delivery_eta"] = .string(formatter.string(from: deliveryETA))
            }
            try await supabase
                .from("orders")
                .update(updates)
                .eq("id", value: payload.orderId)
                .execute()

        case "createExpense":
            let expense = try decoder.decode(ExpenseCreate.self, from: action.payload)
            try await supabase
                .from("trip_expenses")
                .insert(expense)
                .execute()

        case "deleteExpense":
            let payload = try decoder.decode([String: String].self, from: action.payload)
            guard let id = payload["id"] else { return }
            try await supabase
                .from("trip_expenses")
                .delete()
                .eq("id", value: id)
                .execute()

        case "markNotificationRead":
            let payload = try decoder.decode([String: String].self, from: action.payload)
            guard let id = payload["id"] else { return }
            let updates: [String: AnyJSON] = [
                "read_at": .string(ISO8601DateFormatter().string(from: Date()))
            ]
            try await supabase
                .from("driver_notifications")
                .update(updates)
                .eq("id", value: id)
                .execute()

        default:
            print("[PendingActionsQueue] Unknown action type: \(action.actionType)")
        }
    }

    // MARK: - Persistence

    /// Save the current queue to UserDefaults.
    private func saveToStorage() {
        do {
            let data = try JSONEncoder().encode(queue)
            UserDefaults.standard.set(data, forKey: storageKey)
        } catch {
            print("[PendingActionsQueue] Failed to save queue: \(error)")
        }
    }

    /// Load the queue from UserDefaults.
    private func loadFromStorage() -> [PendingAction] {
        guard let data = UserDefaults.standard.data(forKey: storageKey) else {
            return []
        }
        do {
            return try JSONDecoder().decode([PendingAction].self, from: data)
        } catch {
            print("[PendingActionsQueue] Failed to load queue: \(error)")
            return []
        }
    }
}
