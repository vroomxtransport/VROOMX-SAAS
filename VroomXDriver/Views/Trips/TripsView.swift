import SwiftUI

/// Main Trips tab view showing active trips and recent completed trips.
/// Observes DataManager.shared.trips for live updates via Realtime.
struct TripsView: View {
    @ObservedObject private var dataManager = DataManager.shared

    /// Active trips: planned, in_progress, at_terminal
    private var activeTrips: [VroomXTrip] {
        dataManager.trips.filter { $0.isActive }
    }

    /// Completed trips, most recent first (limited to 5 for the main view)
    private var recentCompletedTrips: [VroomXTrip] {
        Array(
            dataManager.trips
                .filter { $0.status == .completed }
                .prefix(5)
        )
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                OfflineBanner()

                if dataManager.isLoading && dataManager.trips.isEmpty {
                    LoadingView(message: "Loading trips...")
                        .frame(minHeight: 300)
                } else if dataManager.trips.isEmpty {
                    emptyState
                } else {
                    // MARK: Active Trips
                    if !activeTrips.isEmpty {
                        activeTripSection
                    }

                    // MARK: Recent Completed
                    if !recentCompletedTrips.isEmpty {
                        recentCompletedSection
                    }

                    // MARK: View All
                    NavigationLink(destination: AllTripsView()) {
                        HStack {
                            Text("View All Trips")
                                .font(.vroomxBodyBold)
                                .foregroundColor(.brandPrimary)
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(.brandPrimary)
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 14)
                        .background(Color.cardBackground)
                        .cornerRadius(12)
                    }
                    .padding(.horizontal, 16)
                }
            }
            .padding(.bottom, 24)
        }
        .background(Color.appBackground)
        .refreshable {
            await dataManager.fetchTrips()
        }
        .navigationTitle("Trips")
    }

    // MARK: - Active Trips Section

    private var activeTripSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Active Trips")
                .font(.vroomxTitleMedium)
                .foregroundColor(.textPrimary)
                .padding(.horizontal, 16)

            ForEach(activeTrips) { trip in
                NavigationLink(destination: TripDetailView(trip: trip)) {
                    TripCardView(trip: trip)
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 16)
            }
        }
    }

    // MARK: - Recent Completed Section

    private var recentCompletedSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            DisclosureGroup {
                VStack(spacing: 8) {
                    ForEach(recentCompletedTrips) { trip in
                        NavigationLink(destination: TripDetailView(trip: trip)) {
                            TripCardView(trip: trip)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.top, 8)
            } label: {
                Text("Recent Completed")
                    .font(.vroomxTitleMedium)
                    .foregroundColor(.textPrimary)
            }
            .tint(.textSecondary)
            .padding(.horizontal, 16)
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 16) {
            Spacer().frame(height: 60)

            Image(systemName: "truck.box")
                .font(.system(size: 48))
                .foregroundColor(.textSecondary.opacity(0.5))

            Text("No Active Trips")
                .font(.vroomxTitleMedium)
                .foregroundColor(.textPrimary)

            Text("When dispatch assigns you a trip, it will appear here.")
                .font(.vroomxBody)
                .foregroundColor(.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)

            Spacer()
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Trip Card View

/// A card displaying trip summary information: trip number, status, dates, route, orders, revenue.
struct TripCardView: View {
    let trip: VroomXTrip

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Header: Trip number + Status badge
            HStack {
                Text(trip.tripNumber ?? "Trip")
                    .font(.vroomxTitle)
                    .foregroundColor(.textPrimary)

                Spacer()

                TripStatusBadge(status: trip.status)
            }

            // Date range
            HStack(spacing: 6) {
                Image(systemName: "calendar")
                    .font(.system(size: 12))
                    .foregroundColor(.textSecondary)

                Text(trip.dateRange)
                    .font(.vroomxCaption)
                    .foregroundColor(.textSecondary)
            }

            // Route
            if trip.originSummary != nil || trip.destinationSummary != nil {
                HStack(spacing: 6) {
                    Image(systemName: "arrow.triangle.swap")
                        .font(.system(size: 12))
                        .foregroundColor(.textSecondary)

                    Text(routeText)
                        .font(.vroomxBody)
                        .foregroundColor(.textPrimary)
                        .lineLimit(1)
                }
            }

            // Bottom row: order count + revenue
            HStack {
                // Order count
                HStack(spacing: 4) {
                    Image(systemName: "shippingbox")
                        .font(.system(size: 11))
                        .foregroundColor(.textSecondary)

                    Text("\(trip.orderCount ?? 0) orders")
                        .font(.vroomxCaption)
                        .foregroundColor(.textSecondary)
                }

                Spacer()

                // Revenue
                Text(formatCurrency(trip.totalRevenue))
                    .font(.vroomxMono)
                    .foregroundColor(.brandSuccess)
            }
        }
        .padding(14)
        .background(Color.cardBackground)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.textSecondary.opacity(0.1), lineWidth: 1)
        )
    }

    private var routeText: String {
        let origin = trip.originSummary ?? "Origin"
        let destination = trip.destinationSummary ?? "Destination"
        return "\(origin) \u{2192} \(destination)"
    }
}

// MARK: - Trip Status Badge

/// Colored capsule badge displaying the trip's current status.
struct TripStatusBadge: View {
    let status: TripStatus

    var body: some View {
        Text(status.displayName)
            .font(.vroomxCaptionSmall)
            .fontWeight(.bold)
            .foregroundColor(status.color)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(status.color.opacity(0.15))
            .clipShape(Capsule())
    }
}

// MARK: - Currency Formatter

/// Formats a Double as USD currency (e.g. "$1,234.56"). Returns "$0.00" for nil.
func formatCurrency(_ value: Double?) -> String {
    let formatter = NumberFormatter()
    formatter.numberStyle = .currency
    formatter.currencyCode = "USD"
    formatter.maximumFractionDigits = 2
    formatter.minimumFractionDigits = 2
    return formatter.string(from: NSNumber(value: value ?? 0)) ?? "$0.00"
}

#Preview {
    NavigationStack {
        TripsView()
    }
}
