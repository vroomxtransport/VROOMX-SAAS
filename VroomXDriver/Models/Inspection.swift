import Foundation

/// Matches VroomX `vehicle_inspections` table (migration 00006).
struct VehicleInspection: Codable, Identifiable {
    let id: String
    let tenantId: String
    let orderId: String
    let driverId: String
    let inspectionType: InspectionType
    let status: InspectionStatus
    let odometerReading: Int?
    let interiorCondition: String?
    let notes: String?
    let gpsLatitude: Double?
    let gpsLongitude: Double?
    let gpsAddress: String?
    let driverSignatureUrl: String?
    let customerSignatureUrl: String?
    let customerName: String?
    let customerNotes: String?
    let completedAt: String?
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case tenantId = "tenant_id"
        case orderId = "order_id"
        case driverId = "driver_id"
        case inspectionType = "inspection_type"
        case status
        case odometerReading = "odometer_reading"
        case interiorCondition = "interior_condition"
        case notes
        case gpsLatitude = "gps_latitude"
        case gpsLongitude = "gps_longitude"
        case gpsAddress = "gps_address"
        case driverSignatureUrl = "driver_signature_url"
        case customerSignatureUrl = "customer_signature_url"
        case customerName = "customer_name"
        case customerNotes = "customer_notes"
        case completedAt = "completed_at"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

/// Matches VroomX `inspection_photos` table (migration 00006).
struct InspectionPhoto: Codable, Identifiable {
    let id: String
    let tenantId: String
    let inspectionId: String
    let photoType: PhotoType
    let storagePath: String
    let thumbnailPath: String?
    let uploadStatus: String
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case tenantId = "tenant_id"
        case inspectionId = "inspection_id"
        case photoType = "photo_type"
        case storagePath = "storage_path"
        case thumbnailPath = "thumbnail_path"
        case uploadStatus = "upload_status"
        case createdAt = "created_at"
    }
}

/// Matches VroomX `inspection_videos` table (migration 00006).
struct InspectionVideo: Codable, Identifiable {
    let id: String
    let tenantId: String
    let inspectionId: String
    let storagePath: String
    let durationSeconds: Int?
    let uploadStatus: String
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case tenantId = "tenant_id"
        case inspectionId = "inspection_id"
        case storagePath = "storage_path"
        case durationSeconds = "duration_seconds"
        case uploadStatus = "upload_status"
        case createdAt = "created_at"
    }
}

/// Matches VroomX `inspection_damages` table (migration 00006).
struct InspectionDamage: Codable, Identifiable {
    let id: String
    let tenantId: String
    let inspectionId: String
    let damageType: DamageType
    let view: String
    let xPosition: Double
    let yPosition: Double
    let description: String?
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case tenantId = "tenant_id"
        case inspectionId = "inspection_id"
        case damageType = "damage_type"
        case view
        case xPosition = "x_position"
        case yPosition = "y_position"
        case description
        case createdAt = "created_at"
    }
}
