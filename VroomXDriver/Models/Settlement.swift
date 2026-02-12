import Foundation

/// Computed settlement summary for a pay period.
/// Not stored in the database -- derived from trips and expenses.
struct Settlement: Identifiable {
    let id = UUID().uuidString
    let payPeriodStart: String
    let payPeriodEnd: String
    let trips: [VroomXTrip]

    // MARK: - Computed Properties

    /// Total revenue across all trips in this settlement.
    var totalRevenue: Double {
        trips.compactMap(\.totalRevenue).reduce(0, +)
    }

    /// Total driver pay across all trips in this settlement.
    var totalDriverPay: Double {
        trips.compactMap(\.driverPay).reduce(0, +)
    }

    /// Total expenses across all trips in this settlement.
    var totalExpenses: Double {
        trips.compactMap(\.totalExpenses).reduce(0, +)
    }

    /// Net earnings = driver pay - expenses.
    var netEarnings: Double {
        totalDriverPay - totalExpenses
    }

    /// Number of trips in this settlement period.
    var tripCount: Int {
        trips.count
    }

    /// Formatted date range for the settlement period.
    var dateRange: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"

        guard let start = formatter.date(from: payPeriodStart),
              let end = formatter.date(from: payPeriodEnd) else {
            return "\(payPeriodStart) - \(payPeriodEnd)"
        }

        let displayFormatter = DateFormatter()
        displayFormatter.dateFormat = "MMM d, yyyy"
        return "\(displayFormatter.string(from: start)) - \(displayFormatter.string(from: end))"
    }
}
