import SwiftUI
import Charts

/// Main Earnings tab view showing current pay period hero card,
/// financial breakdown, weekly earnings chart, and payment history.
struct EarningsView: View {
    @ObservedObject private var dataManager = DataManager.shared

    /// All completed trips from DataManager.
    private var completedTrips: [VroomXTrip] {
        dataManager.trips.filter { $0.status == .completed }
    }

    /// Current bi-weekly pay period (containing today).
    private var currentPeriod: Settlement {
        let (start, end) = PayPeriodCalculator.currentPeriodDates()
        let trips = completedTrips.filter { trip in
            PayPeriodCalculator.tripBelongsToPeriod(trip, start: start, end: end)
        }
        return Settlement(
            payPeriodStart: PayPeriodCalculator.dateToString(start),
            payPeriodEnd: PayPeriodCalculator.dateToString(end),
            trips: trips
        )
    }

    /// Historical pay periods (excluding current), most recent first.
    private var pastPeriods: [Settlement] {
        PayPeriodCalculator.groupIntoPeriods(completedTrips)
    }

    /// Weekly earnings for the last 4 weeks (for the bar chart).
    private var weeklyEarnings: [WeeklyEarning] {
        PayPeriodCalculator.weeklyEarnings(from: completedTrips, weeks: 4)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    heroCard
                    financialBreakdown
                    if !weeklyEarnings.isEmpty {
                        weeklyChart
                    }
                    paymentHistory
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 24)
            }
            .background(Color.appBackground)
            .navigationTitle("Earnings")
            .refreshable {
                await dataManager.fetchTrips()
            }
        }
    }

    // MARK: - Hero Card

    /// Large gradient card showing current pay period totals.
    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(currentPeriod.dateRange)
                        .font(.vroomxCaption)
                        .foregroundColor(.white.opacity(0.85))

                    Text(formatCurrency(currentPeriod.totalDriverPay))
                        .font(.system(size: 36, weight: .heavy).monospacedDigit())
                        .foregroundColor(.white)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 4) {
                    Text("Current Period")
                        .font(.vroomxCaptionSmall)
                        .foregroundColor(.white.opacity(0.9))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Capsule().fill(Color.white.opacity(0.2)))

                    Text("\(currentPeriod.tripCount) trips")
                        .font(.vroomxCaption)
                        .foregroundColor(.white.opacity(0.85))
                }
            }
        }
        .padding(20)
        .background(
            LinearGradient(
                colors: [.brandPrimary, .brandAccent],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: Color.brandPrimary.opacity(0.3), radius: 8, y: 4)
    }

    // MARK: - Financial Breakdown

    /// Four-row breakdown of revenue, driver pay, expenses, and net earnings.
    private var financialBreakdown: some View {
        VStack(spacing: 0) {
            Text("Financial Breakdown")
                .font(.vroomxTitle)
                .foregroundColor(.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, 12)

            breakdownRow(
                label: "Total Revenue",
                value: currentPeriod.totalRevenue,
                color: .textPrimary,
                showDivider: true
            )
            breakdownRow(
                label: "Driver Pay",
                value: currentPeriod.totalDriverPay,
                color: .brandPrimary,
                showDivider: true
            )
            breakdownRow(
                label: "Total Expenses",
                value: currentPeriod.totalExpenses,
                color: currentPeriod.totalExpenses > 0 ? .brandDanger : .textSecondary,
                showDivider: true
            )
            breakdownRow(
                label: "Net Earnings",
                value: currentPeriod.netEarnings,
                color: currentPeriod.netEarnings >= 0 ? .brandSuccess : .brandDanger,
                showDivider: false,
                isBold: true
            )
        }
        .padding(16)
        .background(Color.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    /// A single row in the financial breakdown section.
    private func breakdownRow(
        label: String,
        value: Double,
        color: Color,
        showDivider: Bool,
        isBold: Bool = false
    ) -> some View {
        VStack(spacing: 0) {
            HStack {
                Text(label)
                    .font(isBold ? .vroomxBodyBold : .vroomxBody)
                    .foregroundColor(.textPrimary)

                Spacer()

                Text(formatCurrency(value))
                    .font(isBold ? .system(size: 16, weight: .bold).monospacedDigit() : .vroomxMono)
                    .foregroundColor(color)
            }
            .padding(.vertical, 10)

            if showDivider {
                Divider()
            }
        }
    }

    // MARK: - Weekly Chart

    /// Simple bar chart showing earnings for the last 4 weeks.
    private var weeklyChart: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Weekly Earnings")
                .font(.vroomxTitle)
                .foregroundColor(.textPrimary)

            Chart(weeklyEarnings) { entry in
                BarMark(
                    x: .value("Week", entry.label),
                    y: .value("Earnings", entry.amount)
                )
                .foregroundStyle(
                    LinearGradient(
                        colors: [.brandPrimary, .brandAccent],
                        startPoint: .bottom,
                        endPoint: .top
                    )
                )
                .cornerRadius(4)
            }
            .chartYAxis {
                AxisMarks(position: .leading) { value in
                    AxisValueLabel {
                        if let amount = value.as(Double.self) {
                            Text(formatCompactCurrency(amount))
                                .font(.vroomxCaptionSmall)
                                .foregroundColor(.textSecondary)
                        }
                    }
                }
            }
            .chartXAxis {
                AxisMarks { value in
                    AxisValueLabel()
                        .font(.vroomxCaptionSmall)
                        .foregroundStyle(Color.textSecondary)
                }
            }
            .frame(height: 160)
        }
        .padding(16)
        .background(Color.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - Payment History

    /// List of past pay periods with NavigationLink to settlement detail.
    private var paymentHistory: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Payment History")
                .font(.vroomxTitle)
                .foregroundColor(.textPrimary)

            if pastPeriods.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "clock")
                        .font(.system(size: 32))
                        .foregroundColor(.textSecondary.opacity(0.5))
                    Text("No past settlements yet")
                        .font(.vroomxBody)
                        .foregroundColor(.textSecondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 24)
            } else {
                ForEach(pastPeriods) { settlement in
                    NavigationLink(destination: SettlementDetailView(settlement: settlement)) {
                        settlementRow(settlement)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(16)
        .background(Color.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    /// A single row representing a past pay period.
    private func settlementRow(_ settlement: Settlement) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(settlement.dateRange)
                    .font(.vroomxBodyBold)
                    .foregroundColor(.textPrimary)

                Text("\(settlement.tripCount) trips")
                    .font(.vroomxCaption)
                    .foregroundColor(.textSecondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                Text(formatCurrency(settlement.totalDriverPay))
                    .font(.vroomxMono)
                    .foregroundColor(.brandPrimary)

                Text("Completed")
                    .font(.vroomxCaptionSmall)
                    .foregroundColor(.brandSuccess)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Capsule().fill(Color.brandSuccess.opacity(0.12)))
            }

            Image(systemName: "chevron.right")
                .font(.vroomxCaption)
                .foregroundColor(.textSecondary)
        }
        .padding(.vertical, 8)
    }

    // MARK: - Currency Formatting

    /// Format a value as a USD currency string (e.g. "$1,234.56").
    private func formatCurrency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        return formatter.string(from: NSNumber(value: value)) ?? "$0.00"
    }

    /// Format a value as a compact currency string (e.g. "$1.2K").
    private func formatCompactCurrency(_ value: Double) -> String {
        if value >= 1000 {
            return String(format: "$%.1fK", value / 1000)
        }
        return String(format: "$%.0f", value)
    }
}

// MARK: - Weekly Earning Model

/// Data point for the weekly earnings bar chart.
struct WeeklyEarning: Identifiable {
    let id = UUID()
    let label: String
    let amount: Double
    let weekStart: Date
}

// MARK: - Pay Period Calculator

/// Utility for grouping trips into bi-weekly pay periods.
enum PayPeriodCalculator {
    /// Reference epoch for bi-weekly alignment: Jan 1, 2024 (a Monday).
    private static let referenceDate: Date = {
        var components = DateComponents()
        components.year = 2024
        components.month = 1
        components.day = 1
        return Calendar.current.date(from: components) ?? Date()
    }()

    private static let calendar = Calendar.current
    private static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    /// Returns the start and end dates of the current bi-weekly pay period.
    static func currentPeriodDates() -> (start: Date, end: Date) {
        periodContaining(Date())
    }

    /// Returns the bi-weekly period that contains a given date.
    static func periodContaining(_ date: Date) -> (start: Date, end: Date) {
        let daysSinceRef = calendar.dateComponents([.day], from: referenceDate, to: date).day ?? 0
        let periodIndex = daysSinceRef / 14
        let periodStart = calendar.date(byAdding: .day, value: periodIndex * 14, to: referenceDate)!
        let periodEnd = calendar.date(byAdding: .day, value: 13, to: periodStart)!
        return (periodStart, periodEnd)
    }

    /// Check whether a trip's start_date falls within a given period.
    static func tripBelongsToPeriod(_ trip: VroomXTrip, start: Date, end: Date) -> Bool {
        guard let tripDate = dayFormatter.date(from: trip.startDate) else { return false }
        return tripDate >= start && tripDate <= end
    }

    /// Format a Date to "yyyy-MM-dd" string.
    static func dateToString(_ date: Date) -> String {
        dayFormatter.string(from: date)
    }

    /// Group completed trips into bi-weekly settlements, excluding the current period.
    /// Returns settlements sorted by most recent first.
    static func groupIntoPeriods(_ trips: [VroomXTrip]) -> [Settlement] {
        let (currentStart, _) = currentPeriodDates()

        // Group trips by their period start date
        var periodMap: [Date: [VroomXTrip]] = [:]

        for trip in trips {
            guard let tripDate = dayFormatter.date(from: trip.startDate) else { continue }
            let (periodStart, _) = periodContaining(tripDate)

            // Exclude current period
            guard periodStart < currentStart else { continue }

            periodMap[periodStart, default: []].append(trip)
        }

        // Convert to settlements, sorted descending by period start
        return periodMap.keys.sorted(by: >).map { start in
            let end = calendar.date(byAdding: .day, value: 13, to: start)!
            return Settlement(
                payPeriodStart: dateToString(start),
                payPeriodEnd: dateToString(end),
                trips: periodMap[start] ?? []
            )
        }
    }

    /// Calculate weekly earnings for the last N weeks (for bar chart).
    static func weeklyEarnings(from trips: [VroomXTrip], weeks: Int) -> [WeeklyEarning] {
        let today = Date()
        let weekFormatter = DateFormatter()
        weekFormatter.dateFormat = "MMM d"

        var results: [WeeklyEarning] = []

        for i in (0..<weeks).reversed() {
            guard let weekStart = calendar.date(byAdding: .day, value: -(i * 7), to: calendar.startOfDay(for: today)),
                  let weekEnd = calendar.date(byAdding: .day, value: 6, to: weekStart) else { continue }

            let weekTrips = trips.filter { trip in
                guard let tripDate = dayFormatter.date(from: trip.startDate) else { return false }
                return tripDate >= weekStart && tripDate <= weekEnd
            }

            let total = weekTrips.compactMap(\.driverPay).reduce(0, +)
            let label = weekFormatter.string(from: weekStart)

            results.append(WeeklyEarning(label: label, amount: total, weekStart: weekStart))
        }

        return results
    }
}

// MARK: - Preview

#Preview {
    EarningsView()
}
