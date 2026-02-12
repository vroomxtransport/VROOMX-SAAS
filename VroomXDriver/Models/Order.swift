import Foundation

/// Matches VroomX `orders` table (migrations 00002, 00003, 00006).
/// Includes trip_id (00003), pickup_eta, delivery_eta (00006).
struct VroomXOrder: Codable, Identifiable {
    let id: String
    let tenantId: String
    let orderNumber: String?
    let brokerId: String?
    let driverId: String?
    let tripId: String?
    let vehicleVin: String?
    let vehicleYear: Int?
    let vehicleMake: String?
    let vehicleModel: String?
    let vehicleType: String?
    let vehicleColor: String?
    let status: OrderStatus
    let cancelledReason: String?
    // Pickup
    let pickupLocation: String?
    let pickupCity: String?
    let pickupState: String?
    let pickupZip: String?
    let pickupContactName: String?
    let pickupContactPhone: String?
    let pickupDate: String?
    // Delivery
    let deliveryLocation: String?
    let deliveryCity: String?
    let deliveryState: String?
    let deliveryZip: String?
    let deliveryContactName: String?
    let deliveryContactPhone: String?
    let deliveryDate: String?
    // Actual dates
    let actualPickupDate: String?
    let actualDeliveryDate: String?
    // ETAs (migration 00006)
    let pickupEta: String?
    let deliveryEta: String?
    // Financial
    let revenue: Double?
    let carrierPay: Double?
    let brokerFee: Double?
    let paymentType: PaymentType?
    let paymentStatus: String?
    let invoiceDate: String?
    let amountPaid: Double?
    // Metadata
    let notes: String?
    let createdAt: String
    let updatedAt: String

    // MARK: - Computed Properties

    /// Vehicle description (e.g. "2024 Toyota Camry" or "Unknown Vehicle").
    var vehicleDescription: String {
        let parts = [
            vehicleYear.map { String($0) },
            vehicleMake,
            vehicleModel
        ].compactMap { $0 }
        return parts.isEmpty ? "Unknown Vehicle" : parts.joined(separator: " ")
    }

    /// Full pickup address (e.g. "123 Main St, Dallas, TX 75201").
    var pickupFullAddress: String {
        [pickupLocation, pickupCity, pickupState, pickupZip]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
            .joined(separator: ", ")
    }

    /// Full delivery address (e.g. "456 Oak Ave, Houston, TX 77001").
    var deliveryFullAddress: String {
        [deliveryLocation, deliveryCity, deliveryState, deliveryZip]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
            .joined(separator: ", ")
    }

    // MARK: - CodingKeys

    enum CodingKeys: String, CodingKey {
        case id
        case tenantId = "tenant_id"
        case orderNumber = "order_number"
        case brokerId = "broker_id"
        case driverId = "driver_id"
        case tripId = "trip_id"
        case vehicleVin = "vehicle_vin"
        case vehicleYear = "vehicle_year"
        case vehicleMake = "vehicle_make"
        case vehicleModel = "vehicle_model"
        case vehicleType = "vehicle_type"
        case vehicleColor = "vehicle_color"
        case status
        case cancelledReason = "cancelled_reason"
        case pickupLocation = "pickup_location"
        case pickupCity = "pickup_city"
        case pickupState = "pickup_state"
        case pickupZip = "pickup_zip"
        case pickupContactName = "pickup_contact_name"
        case pickupContactPhone = "pickup_contact_phone"
        case pickupDate = "pickup_date"
        case deliveryLocation = "delivery_location"
        case deliveryCity = "delivery_city"
        case deliveryState = "delivery_state"
        case deliveryZip = "delivery_zip"
        case deliveryContactName = "delivery_contact_name"
        case deliveryContactPhone = "delivery_contact_phone"
        case deliveryDate = "delivery_date"
        case actualPickupDate = "actual_pickup_date"
        case actualDeliveryDate = "actual_delivery_date"
        case pickupEta = "pickup_eta"
        case deliveryEta = "delivery_eta"
        case revenue
        case carrierPay = "carrier_pay"
        case brokerFee = "broker_fee"
        case paymentType = "payment_type"
        case paymentStatus = "payment_status"
        case invoiceDate = "invoice_date"
        case amountPaid = "amount_paid"
        case notes
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}
