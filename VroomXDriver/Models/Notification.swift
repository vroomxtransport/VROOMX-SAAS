import Foundation

/// Matches VroomX `driver_notifications` table (migration 00006).
/// Note: `data` column is JSONB in the database, stored as a JSON string here.
struct DriverNotification: Codable, Identifiable, Equatable {
    let id: String
    let tenantId: String
    let driverId: String
    let notificationType: NotificationType
    let title: String
    let body: String
    let data: String?
    let readAt: String?
    let createdAt: String

    /// Whether this notification has been read.
    var isRead: Bool {
        readAt != nil
    }

    enum CodingKeys: String, CodingKey {
        case id
        case tenantId = "tenant_id"
        case driverId = "driver_id"
        case notificationType = "notification_type"
        case title
        case body
        case data
        case readAt = "read_at"
        case createdAt = "created_at"
    }
}
