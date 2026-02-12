import SwiftUI

/// The driver's primary landing screen after login.
/// Shows a personalized greeting, quick stat cards, module tabs for order filtering,
/// and a scrollable list of order cards with pull-to-refresh.
struct HomeView: View {
    @ObservedObject private var dataManager = DataManager.shared
    @EnvironmentObject private var authManager: AuthManager

    @State private var selectedModule: OrderModule = .pickup

    // MARK: - Computed Properties

    /// Orders filtered by the currently selected module tab.
    private var filteredOrders: [VroomXOrder] {
        let statuses = selectedModule.statuses
        return dataManager.orders.filter { statuses.contains($0.status) }
    }

    /// Count of orders per module for tab badges and stat cards.
    private var orderCounts: [OrderModule: Int] {
        var counts: [OrderModule: Int] = [:]
        for module in OrderModule.allCases {
            let statuses = module.statuses
            counts[module] = dataManager.orders.filter { statuses.contains($0.status) }.count
        }
        return counts
    }

    // MARK: - Body

    var body: some View {
        ZStack(alignment: .top) {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Greeting + date header
                    greetingSection

                    // Quick stats row
                    statsSection

                    // Module tabs
                    ModuleTabsView(
                        selectedModule: $selectedModule,
                        orderCounts: orderCounts
                    )
                    .padding(.horizontal, 16)

                    // Order list
                    orderListSection
                }
                .padding(.top, 16)
                .padding(.bottom, 32)
            }
            .refreshable {
                await dataManager.fetchAll()
            }
            .background(Color.appBackground)

            // Offline banner overlaid at the top
            OfflineBanner()
        }
        .navigationTitle("Home")
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Greeting Section

    private var greetingSection: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(greetingText)
                .font(.vroomxTitleLarge)
                .foregroundColor(.textPrimary)

            Text(formattedDate)
                .font(.vroomxBody)
                .foregroundColor(.textSecondary)
        }
        .padding(.horizontal, 16)
    }

    /// Dynamic greeting based on time of day and driver's first name.
    private var greetingText: String {
        let hour = Calendar.current.component(.hour, from: Date())
        let timeGreeting: String
        switch hour {
        case 0..<12:
            timeGreeting = "Good morning"
        case 12..<17:
            timeGreeting = "Good afternoon"
        default:
            timeGreeting = "Good evening"
        }

        if let driver = authManager.currentDriver {
            return "\(timeGreeting), \(driver.firstName)"
        }
        return timeGreeting
    }

    /// Formatted current date (e.g., "Wednesday, February 12").
    private var formattedDate: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE, MMMM d"
        return formatter.string(from: Date())
    }

    // MARK: - Stats Section

    private var statsSection: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                StatCard(
                    icon: "arrow.up.circle.fill",
                    count: orderCounts[.pickup] ?? 0,
                    label: "Pickup",
                    color: .brandWarning
                )

                StatCard(
                    icon: "shippingbox.fill",
                    count: orderCounts[.delivery] ?? 0,
                    label: "Delivery",
                    color: .brandPrimary
                )

                StatCard(
                    icon: "checkmark.circle.fill",
                    count: orderCounts[.completed] ?? 0,
                    label: "Completed",
                    color: .brandSuccess
                )

                StatCard(
                    icon: "list.bullet.rectangle.fill",
                    count: dataManager.orders.count,
                    label: "Total",
                    color: .brandAccent
                )
            }
            .padding(.horizontal, 16)
        }
    }

    // MARK: - Order List Section

    private var orderListSection: some View {
        LazyVStack(spacing: 12) {
            if filteredOrders.isEmpty {
                emptyState
            } else {
                ForEach(filteredOrders) { order in
                    OrderCardView(order: order)
                        .padding(.horizontal, 16)
                }
            }
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "truck.box")
                .font(.system(size: 40))
                .foregroundColor(.textSecondary.opacity(0.5))

            Text("No orders in this category")
                .font(.vroomxBody)
                .foregroundColor(.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 48)
    }
}

// MARK: - Stat Card

/// A compact stat card showing an icon, count, and label with accent color.
private struct StatCard: View {
    let icon: String
    let count: Int
    let label: String
    let color: Color

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundColor(color)

            Text("\(count)")
                .font(.system(size: 22, weight: .bold).monospacedDigit())
                .foregroundColor(.textPrimary)

            Text(label)
                .font(.vroomxCaptionSmall)
                .foregroundColor(.textSecondary)
        }
        .frame(width: 80, height: 90)
        .background(Color.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(color.opacity(0.25), lineWidth: 1)
        )
    }
}

#Preview {
    NavigationStack {
        HomeView()
            .environmentObject(AuthManager())
    }
}
