import Foundation

/// Matches VroomX `trips` table (migration 00003).
struct VroomXTrip: Codable, Identifiable {
    let id: String
    let tenantId: String
    let tripNumber: String?
    let driverId: String
    let truckId: String
    let status: TripStatus
    let startDate: String
    let endDate: String
    let carrierPay: Double?
    let totalRevenue: Double?
    let totalBrokerFees: Double?
    let driverPay: Double?
    let totalExpenses: Double?
    let netProfit: Double?
    let orderCount: Int?
    let originSummary: String?
    let destinationSummary: String?
    let notes: String?
    let createdAt: String
    let updatedAt: String

    // MARK: - Computed Properties

    /// Formatted date range string (e.g. "Jan 15 - Jan 20").
    var dateRange: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"

        guard let start = formatter.date(from: startDate),
              let end = formatter.date(from: endDate) else {
            return "\(startDate) - \(endDate)"
        }

        let displayFormatter = DateFormatter()
        displayFormatter.dateFormat = "MMM d"
        return "\(displayFormatter.string(from: start)) - \(displayFormatter.string(from: end))"
    }

    /// Whether this trip has an active (non-completed) status.
    var isActive: Bool {
        status != .completed
    }

    // MARK: - CodingKeys

    enum CodingKeys: String, CodingKey {
        case id
        case tenantId = "tenant_id"
        case tripNumber = "trip_number"
        case driverId = "driver_id"
        case truckId = "truck_id"
        case status
        case startDate = "start_date"
        case endDate = "end_date"
        case carrierPay = "carrier_pay"
        case totalRevenue = "total_revenue"
        case totalBrokerFees = "total_broker_fees"
        case driverPay = "driver_pay"
        case totalExpenses = "total_expenses"
        case netProfit = "net_profit"
        case orderCount = "order_count"
        case originSummary = "origin_summary"
        case destinationSummary = "destination_summary"
        case notes
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}
