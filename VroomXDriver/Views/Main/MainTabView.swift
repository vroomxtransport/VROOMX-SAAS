import SwiftUI

/// The 5-tab main navigation shell for authenticated drivers.
/// Mirrors the Horizon Star driver app tab structure with VroomX branding.
struct MainTabView: View {
    @State private var selectedTab: Tab = .home

    var body: some View {
        TabView(selection: $selectedTab) {
            // MARK: 1. Home
            NavigationStack {
                PlaceholderTabView(
                    title: "Home",
                    icon: "house.fill",
                    description: "Greeting, quick stats, order cards"
                )
            }
            .tabItem {
                Label("Home", systemImage: "house.fill")
            }
            .tag(Tab.home)

            // MARK: 2. Trips
            NavigationStack {
                PlaceholderTabView(
                    title: "Trips",
                    icon: "shippingbox.fill",
                    description: "Assigned trip list and trip details"
                )
            }
            .tabItem {
                Label("Trips", systemImage: "shippingbox.fill")
            }
            .tag(Tab.trips)

            // MARK: 3. Earnings
            NavigationStack {
                PlaceholderTabView(
                    title: "Earnings",
                    icon: "wallet.pass.fill",
                    description: "Pay period, financial breakdown, history"
                )
            }
            .tabItem {
                Label("Earnings", systemImage: "wallet.pass.fill")
            }
            .tag(Tab.earnings)

            // MARK: 4. Messages
            NavigationStack {
                PlaceholderTabView(
                    title: "Messages",
                    icon: "message.fill",
                    description: "Dispatch notifications and messages"
                )
            }
            .tabItem {
                Label("Messages", systemImage: "message.fill")
            }
            .tag(Tab.messages)

            // MARK: 5. Profile
            NavigationStack {
                PlaceholderTabView(
                    title: "Profile",
                    icon: "person.fill",
                    description: "Driver stats, theme, preferences, sign out"
                )
            }
            .tabItem {
                Label("Profile", systemImage: "person.fill")
            }
            .tag(Tab.profile)
        }
        .tint(Color.brandPrimary)
    }
}

// MARK: - Tab Enum

extension MainTabView {
    /// The five primary tabs in the driver app.
    enum Tab: String, CaseIterable {
        case home
        case trips
        case earnings
        case messages
        case profile
    }
}

// MARK: - Placeholder Tab View

/// Temporary placeholder for tabs that will be built in later plans.
struct PlaceholderTabView: View {
    let title: String
    let icon: String
    let description: String

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundColor(.brandPrimary.opacity(0.5))

            Text(title)
                .font(.vroomxTitleMedium)
                .foregroundColor(.textPrimary)

            Text(description)
                .font(.vroomxCaption)
                .foregroundColor(.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.appBackground)
        .navigationTitle(title)
    }
}
