import Foundation
import UIKit
import UserNotifications
import Supabase

/// Manages push notification registration, device token storage,
/// foreground/background notification handling, and unread badge count.
///
/// Conforms to `UNUserNotificationCenterDelegate` to handle notification
/// presentation and tap actions. Integrates with `DataManager` for data
/// refresh when notifications arrive.
@MainActor
final class NotificationManager: NSObject, ObservableObject {
    /// Shared singleton instance.
    static let shared = NotificationManager()

    // MARK: - Published State

    /// Number of unread notifications for the Messages tab badge.
    @Published var unreadCount: Int = 0

    /// The APNs device token as a hex string (nil if not registered).
    @Published var deviceToken: String?

    // MARK: - Private

    private let supabase = SupabaseManager.shared.client

    private override init() {
        super.init()
        UNUserNotificationCenter.current().delegate = self
    }

    // MARK: - Permission & Registration

    /// Requests notification permission from the user, then registers for remote notifications.
    func requestPermission() {
        UNUserNotificationCenter.current().requestAuthorization(
            options: [.alert, .badge, .sound]
        ) { granted, error in
            if let error {
                print("[NotificationManager] Permission error: \(error.localizedDescription)")
                return
            }

            if granted {
                DispatchQueue.main.async {
                    UIApplication.shared.registerForRemoteNotifications()
                }
                print("[NotificationManager] Permission granted")
            } else {
                print("[NotificationManager] Permission denied")
            }
        }
    }

    /// Called by the AppDelegate (or SceneDelegate) when APNs returns a device token.
    /// Converts raw `Data` to hex string and stores it.
    func handleDeviceToken(_ tokenData: Data) {
        let hex = tokenData.map { String(format: "%02x", $0) }.joined()
        deviceToken = hex
        print("[NotificationManager] Device token: \(hex)")
    }

    /// Called when APNs registration fails.
    func handleRegistrationError(_ error: Error) {
        print("[NotificationManager] Registration failed: \(error.localizedDescription)")
    }

    // MARK: - Device Token Storage

    /// Registers (upserts) the current device token in the `device_tokens` table.
    /// Associates the token with the given driver and their tenant (from the JWT).
    func registerDeviceToken(driverId: String) async {
        guard let token = deviceToken else {
            print("[NotificationManager] No device token to register")
            return
        }

        do {
            // Fetch tenant_id from the driver record
            let drivers: [VroomXDriverModel] = try await supabase
                .from("drivers")
                .select("tenant_id")
                .eq("id", value: driverId)
                .limit(1)
                .execute()
                .value

            guard let tenantId = drivers.first?.tenantId else {
                print("[NotificationManager] Could not resolve tenant_id for driver")
                return
            }

            let payload: [String: String] = [
                "tenant_id": tenantId,
                "driver_id": driverId,
                "device_token": token,
                "platform": "ios",
                "last_active_at": ISO8601DateFormatter().string(from: Date())
            ]

            try await supabase
                .from("device_tokens")
                .upsert(payload, onConflict: "device_token")
                .execute()

            print("[NotificationManager] Device token registered for driver \(driverId)")
        } catch {
            print("[NotificationManager] registerDeviceToken failed: \(error)")
        }
    }

    /// Removes the current device token from `device_tokens`. Called on logout.
    func deregisterDeviceToken() async {
        guard let token = deviceToken else { return }

        do {
            try await supabase
                .from("device_tokens")
                .delete()
                .eq("device_token", value: token)
                .execute()

            deviceToken = nil
            print("[NotificationManager] Device token deregistered")
        } catch {
            print("[NotificationManager] deregisterDeviceToken failed: \(error)")
        }
    }

    // MARK: - Badge Management

    /// Queries `driver_notifications` for unread count (where `read_at IS NULL`)
    /// and updates the published `unreadCount` and the app icon badge number.
    func updateBadgeCount() async {
        guard let driverId = DataManager.shared.driverId else { return }

        do {
            let response = try await supabase
                .from("driver_notifications")
                .select("id", head: false)
                .eq("driver_id", value: driverId)
                .filter("read_at", operator: "is", value: "null")
                .execute()

            // Parse the response data to count rows
            if let rows = try? JSONSerialization.jsonObject(with: response.data) as? [[String: Any]] {
                unreadCount = rows.count
            }
        } catch {
            print("[NotificationManager] updateBadgeCount failed: \(error)")
            // Fallback: compute from local notifications array
            unreadCount = DataManager.shared.notifications.filter { !$0.isRead }.count
        }

        // Update app icon badge
        try? await UNUserNotificationCenter.current().setBadgeCount(unreadCount)
    }

    /// Convenience to refresh badge from local DataManager notifications array.
    func updateBadgeFromLocal() {
        unreadCount = DataManager.shared.notifications.filter { !$0.isRead }.count
        Task { try? await UNUserNotificationCenter.current().setBadgeCount(unreadCount) }
    }

    // MARK: - Notification Parsing

    /// Parsed data from a push notification payload.
    struct NotificationPayload {
        let notificationType: NotificationType?
        let tripId: String?
        let orderId: String?
        let message: String?
    }

    /// Extracts structured data from the APNs `userInfo` dictionary.
    private func parsePayload(_ userInfo: [AnyHashable: Any]) -> NotificationPayload {
        let typeString = userInfo["notification_type"] as? String
        let notificationType = typeString.flatMap { NotificationType(rawValue: $0) }
        let tripId = userInfo["trip_id"] as? String
        let orderId = userInfo["order_id"] as? String
        let message = userInfo["message"] as? String

        return NotificationPayload(
            notificationType: notificationType,
            tripId: tripId,
            orderId: orderId,
            message: message
        )
    }

    /// Refreshes the appropriate DataManager data based on notification type.
    private func refreshData(for payload: NotificationPayload) async {
        switch payload.notificationType {
        case .trip_assignment:
            await DataManager.shared.fetchTrips()
            await DataManager.shared.fetchNotifications()
        case .status_change:
            await DataManager.shared.fetchOrders()
            await DataManager.shared.fetchNotifications()
        case .dispatch_message:
            await DataManager.shared.fetchNotifications()
        case .urgent:
            await DataManager.shared.fetchNotifications()
        case .none:
            await DataManager.shared.fetchAll()
        }

        await updateBadgeCount()
    }
}

// MARK: - UNUserNotificationCenterDelegate

extension NotificationManager: UNUserNotificationCenterDelegate {

    /// Called when a notification arrives while the app is in the foreground.
    /// Shows the banner, plays sound, and updates the badge.
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        let userInfo = notification.request.content.userInfo

        Task { @MainActor in
            let payload = parsePayload(userInfo)
            await refreshData(for: payload)
        }

        // Show banner + sound + badge even in foreground
        completionHandler([.banner, .sound, .badge])
    }

    /// Called when the user taps on a notification (from lock screen or notification center).
    /// Parses the payload and triggers navigation or data refresh.
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo

        Task { @MainActor in
            let payload = parsePayload(userInfo)

            // Refresh data for the notification type
            await refreshData(for: payload)

            // Post navigation notification for the app to handle
            if let tripId = payload.tripId {
                NotificationCenter.default.post(
                    name: .navigateToTrip,
                    object: nil,
                    userInfo: ["tripId": tripId]
                )
            } else if let orderId = payload.orderId {
                NotificationCenter.default.post(
                    name: .navigateToOrder,
                    object: nil,
                    userInfo: ["orderId": orderId]
                )
            }

            // If urgent, post alert notification
            if payload.notificationType == .urgent, let message = payload.message {
                NotificationCenter.default.post(
                    name: .showUrgentAlert,
                    object: nil,
                    userInfo: ["message": message]
                )
            }
        }

        completionHandler()
    }
}

// MARK: - Navigation Notification Names

extension Notification.Name {
    /// Navigate to a specific trip detail view.
    static let navigateToTrip = Notification.Name("navigateToTrip")

    /// Navigate to a specific order detail view.
    static let navigateToOrder = Notification.Name("navigateToOrder")

    /// Show an urgent alert dialog with a message.
    static let showUrgentAlert = Notification.Name("showUrgentAlert")
}
