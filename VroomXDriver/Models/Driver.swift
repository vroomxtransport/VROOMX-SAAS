import Foundation

/// Matches VroomX `drivers` table (migrations 00002 + 00006).
/// Uses `VroomXDriver` name to avoid collision with the app module name.
struct VroomXDriverModel: Codable, Identifiable {
    let id: String
    let tenantId: String
    let firstName: String
    let lastName: String
    let email: String?
    let phone: String?
    let address: String?
    let city: String?
    let state: String?
    let zip: String?
    let licenseNumber: String?
    let driverType: DriverType
    let driverStatus: String
    let payType: DriverPayType
    let payRate: Double
    let authUserId: String?
    let pinHash: String?
    let notes: String?
    let createdAt: String
    let updatedAt: String

    // MARK: - Computed Properties

    var fullName: String {
        "\(firstName) \(lastName)"
    }

    var initials: String {
        let first = firstName.prefix(1).uppercased()
        let last = lastName.prefix(1).uppercased()
        return "\(first)\(last)"
    }

    var isActive: Bool {
        driverStatus == "active"
    }

    // MARK: - CodingKeys

    enum CodingKeys: String, CodingKey {
        case id
        case tenantId = "tenant_id"
        case firstName = "first_name"
        case lastName = "last_name"
        case email
        case phone
        case address
        case city
        case state
        case zip
        case licenseNumber = "license_number"
        case driverType = "driver_type"
        case driverStatus = "driver_status"
        case payType = "pay_type"
        case payRate = "pay_rate"
        case authUserId = "auth_user_id"
        case pinHash = "pin_hash"
        case notes
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}
