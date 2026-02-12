import SwiftUI

/// Full trip history view with search and status grouping.
/// Shows all trips (active and completed) with search by trip_number.
struct AllTripsView: View {
    @ObservedObject private var dataManager = DataManager.shared
    @State private var searchText: String = ""

    /// Trips filtered by search text (matches trip_number)
    private var filteredTrips: [VroomXTrip] {
        if searchText.isEmpty {
            return dataManager.trips
        }
        let query = searchText.lowercased()
        return dataManager.trips.filter {
            ($0.tripNumber ?? "").lowercased().contains(query)
        }
    }

    /// Active trips: planned, in_progress, at_terminal
    private var activeTrips: [VroomXTrip] {
        filteredTrips.filter { $0.isActive }
    }

    /// Completed trips
    private var completedTrips: [VroomXTrip] {
        filteredTrips.filter { $0.status == .completed }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                OfflineBanner()

                // Search bar
                searchBar

                if filteredTrips.isEmpty {
                    emptySearchState
                } else {
                    // Active section
                    if !activeTrips.isEmpty {
                        tripSection(title: "Active", trips: activeTrips)
                    }

                    // Completed section
                    if !completedTrips.isEmpty {
                        tripSection(title: "Completed", trips: completedTrips)
                    }
                }
            }
            .padding(.bottom, 24)
        }
        .background(Color.appBackground)
        .refreshable {
            await dataManager.fetchTrips()
        }
        .navigationTitle("All Trips")
        .navigationBarTitleDisplayMode(.large)
    }

    // MARK: - Search Bar

    private var searchBar: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 14))
                .foregroundColor(.textSecondary)

            TextField("Search by trip number...", text: $searchText)
                .font(.vroomxBody)
                .foregroundColor(.textPrimary)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)

            if !searchText.isEmpty {
                Button {
                    searchText = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 14))
                        .foregroundColor(.textSecondary)
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Color.cardBackground)
        .cornerRadius(10)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Color.textSecondary.opacity(0.15), lineWidth: 1)
        )
        .padding(.horizontal, 16)
    }

    // MARK: - Trip Section

    private func tripSection(title: String, trips: [VroomXTrip]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(title)
                    .font(.vroomxTitleMedium)
                    .foregroundColor(.textPrimary)

                Text("\(trips.count)")
                    .font(.vroomxCaption)
                    .foregroundColor(.textSecondary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(Color.textSecondary.opacity(0.12))
                    .clipShape(Capsule())
            }
            .padding(.horizontal, 16)

            ForEach(trips) { trip in
                NavigationLink(destination: TripDetailView(trip: trip)) {
                    TripCardView(trip: trip)
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 16)
            }
        }
    }

    // MARK: - Empty Search State

    private var emptySearchState: some View {
        VStack(spacing: 12) {
            Spacer().frame(height: 60)

            Image(systemName: "magnifyingglass")
                .font(.system(size: 36))
                .foregroundColor(.textSecondary.opacity(0.5))

            if searchText.isEmpty {
                Text("No Trips Yet")
                    .font(.vroomxTitleMedium)
                    .foregroundColor(.textPrimary)

                Text("Your trip history will appear here.")
                    .font(.vroomxBody)
                    .foregroundColor(.textSecondary)
            } else {
                Text("No Results")
                    .font(.vroomxTitleMedium)
                    .foregroundColor(.textPrimary)

                Text("No trips match \"\(searchText)\"")
                    .font(.vroomxBody)
                    .foregroundColor(.textSecondary)
            }

            Spacer()
        }
        .frame(maxWidth: .infinity)
    }
}

#Preview {
    NavigationStack {
        AllTripsView()
    }
}
