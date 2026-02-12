import SwiftUI
import LocalAuthentication
import UserNotifications

/// Profile tab: driver info, stats, preferences, app info, and sign out.
/// Provides driver self-service: theme toggle, biometric settings, cache management,
/// and secure sign out with full teardown of data sources.
struct ProfileView: View {
    @EnvironmentObject private var authManager: AuthManager
    @EnvironmentObject private var themeManager: ThemeManager
    @ObservedObject private var dataManager = DataManager.shared
    @ObservedObject private var networkMonitor = NetworkMonitor.shared

    // MARK: - State

    @State private var showSignOutAlert = false
    @State private var showClearCacheAlert = false
    @State private var biometricEnabled: Bool = false
    @State private var notificationStatus: String = "Checking..."
    @State private var pendingActionsCount: Int = 0
    @State private var pendingUploadsCount: Int = 0

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // MARK: - Driver Info Header
                driverInfoSection

                // MARK: - Stats Section
                statsSection

                // MARK: - Preferences Section
                preferencesSection

                // MARK: - App Info Section
                appInfoSection

                // MARK: - Sign Out
                signOutSection

                // MARK: - Footer
                footerSection
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 20)
        }
        .background(Color.appBackground)
        .navigationTitle("Profile")
        .onAppear {
            loadBiometricState()
            checkNotificationStatus()
            loadPendingCounts()
        }
        .alert("Sign Out", isPresented: $showSignOutAlert) {
            Button("Cancel", role: .cancel) {}
            Button("Sign Out", role: .destructive) {
                performSignOut()
            }
        } message: {
            Text("Are you sure? All cached data will be cleared.")
        }
        .alert("Clear Cache", isPresented: $showClearCacheAlert) {
            Button("Cancel", role: .cancel) {}
            Button("Clear", role: .destructive) {
                CacheManager.shared.clearAllCache()
            }
        } message: {
            Text("This will remove all locally cached data. Fresh data will be fetched on next sync.")
        }
    }

    // MARK: - Driver Info Header

    private var driverInfoSection: some View {
        VStack(spacing: 12) {
            // Initials avatar
            if let driver = authManager.currentDriver {
                ZStack {
                    Circle()
                        .fill(Color.brandPrimary)
                        .frame(width: 80, height: 80)

                    Text(driver.initials)
                        .font(.system(size: 28, weight: .heavy))
                        .foregroundColor(.white)
                }

                // Full name
                Text(driver.fullName)
                    .font(.vroomxTitleMedium)
                    .foregroundColor(.textPrimary)

                // Email
                if let email = driver.email {
                    Text(email)
                        .font(.vroomxBody)
                        .foregroundColor(.textSecondary)
                }

                // Driver type badge
                Text(driverTypeBadge(driver.driverType))
                    .font(.vroomxCaptionSmall)
                    .foregroundColor(.white)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(
                        Capsule()
                            .fill(driver.driverType == .company ? Color.brandPrimary : Color.brandAccent)
                    )

                // License number
                if let license = driver.licenseNumber, !license.isEmpty {
                    HStack(spacing: 4) {
                        Image(systemName: "creditcard.fill")
                            .font(.vroomxCaption)
                            .foregroundColor(.textSecondary)
                        Text("License: \(license)")
                            .font(.vroomxCaption)
                            .foregroundColor(.textSecondary)
                    }
                }
            } else {
                // Fallback if driver not loaded
                ZStack {
                    Circle()
                        .fill(Color.brandPrimary.opacity(0.3))
                        .frame(width: 80, height: 80)
                    Image(systemName: "person.fill")
                        .font(.system(size: 32))
                        .foregroundColor(.textSecondary)
                }
                Text("Driver profile unavailable")
                    .font(.vroomxBody)
                    .foregroundColor(.textSecondary)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 20)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.cardBackground)
        )
    }

    // MARK: - Stats Section

    private var statsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Statistics")
                .font(.vroomxTitle)
                .foregroundColor(.textPrimary)
                .padding(.leading, 4)

            LazyVGrid(columns: [
                GridItem(.flexible(), spacing: 12),
                GridItem(.flexible(), spacing: 12)
            ], spacing: 12) {
                statCard(
                    icon: "shippingbox.fill",
                    value: "\(totalTripsCount)",
                    label: "Total Trips",
                    color: .brandPrimary
                )

                statCard(
                    icon: "truck.box.fill",
                    value: "\(activeTripsCount)",
                    label: "Active Trips",
                    color: .brandWarning
                )

                statCard(
                    icon: "dollarsign.circle.fill",
                    value: formattedCurrency(totalEarnings),
                    label: "Total Earnings",
                    color: .brandSuccess
                )

                statCard(
                    icon: "calendar.badge.clock",
                    value: formattedCurrency(currentPeriodEarnings),
                    label: "Current Period",
                    color: .brandAccent
                )
            }
        }
    }

    private func statCard(icon: String, value: String, label: String, color: Color) -> some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundColor(color)

            Text(value)
                .font(.system(size: 20, weight: .bold).monospacedDigit())
                .foregroundColor(.textPrimary)

            Text(label)
                .font(.vroomxCaption)
                .foregroundColor(.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.cardBackground)
        )
    }

    // MARK: - Preferences Section

    private var preferencesSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Preferences")
                .font(.vroomxTitle)
                .foregroundColor(.textPrimary)
                .padding(.leading, 4)
                .padding(.bottom, 12)

            VStack(spacing: 0) {
                // Dark mode toggle
                preferenceRow(
                    icon: themeManager.isDarkMode ? "moon.fill" : "sun.max.fill",
                    iconColor: themeManager.isDarkMode ? .brandAccent : .brandWarning,
                    title: "Dark Mode"
                ) {
                    Toggle("", isOn: $themeManager.isDarkMode)
                        .tint(Color.brandPrimary)
                        .labelsHidden()
                }

                Divider().padding(.leading, 52)

                // Biometric toggle
                preferenceRow(
                    icon: biometricIcon,
                    iconColor: .brandPrimary,
                    title: biometricTitle
                ) {
                    Toggle("", isOn: $biometricEnabled)
                        .tint(Color.brandPrimary)
                        .labelsHidden()
                        .onChange(of: biometricEnabled) { _, newValue in
                            handleBiometricToggle(newValue)
                        }
                }

                Divider().padding(.leading, 52)

                // Notification status
                preferenceRow(
                    icon: "bell.fill",
                    iconColor: notificationStatus == "Enabled" ? .brandSuccess : .textSecondary,
                    title: "Push Notifications"
                ) {
                    HStack(spacing: 4) {
                        Text(notificationStatus)
                            .font(.vroomxCaption)
                            .foregroundColor(.textSecondary)

                        if notificationStatus == "Disabled" {
                            Button {
                                openAppSettings()
                            } label: {
                                Image(systemName: "arrow.up.right.square")
                                    .font(.vroomxCaption)
                                    .foregroundColor(.brandPrimary)
                            }
                        }
                    }
                }
            }
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.cardBackground)
            )
        }
    }

    private func preferenceRow<Content: View>(
        icon: String,
        iconColor: Color,
        title: String,
        @ViewBuilder trailing: () -> Content
    ) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundColor(iconColor)
                .frame(width: 28, height: 28)

            Text(title)
                .font(.vroomxBodyBold)
                .foregroundColor(.textPrimary)

            Spacer()

            trailing()
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 12)
    }

    // MARK: - App Info Section

    private var appInfoSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("App Info")
                .font(.vroomxTitle)
                .foregroundColor(.textPrimary)
                .padding(.leading, 4)
                .padding(.bottom, 12)

            VStack(spacing: 0) {
                // Version
                infoRow(
                    icon: "info.circle.fill",
                    title: "Version",
                    value: Config.appVersion
                )

                Divider().padding(.leading, 52)

                // Last sync
                infoRow(
                    icon: "arrow.triangle.2.circlepath",
                    title: "Last Sync",
                    value: lastSyncText
                )

                Divider().padding(.leading, 52)

                // Pending actions
                infoRow(
                    icon: "clock.arrow.circlepath",
                    title: "Pending Syncs",
                    value: "\(pendingActionsCount) pending"
                )

                Divider().padding(.leading, 52)

                // Clear cache button
                HStack(spacing: 12) {
                    Image(systemName: "trash.circle.fill")
                        .font(.system(size: 16))
                        .foregroundColor(.brandWarning)
                        .frame(width: 28, height: 28)

                    Button("Clear Cache") {
                        showClearCacheAlert = true
                    }
                    .font(.vroomxBodyBold)
                    .foregroundColor(.brandWarning)

                    Spacer()
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 12)
            }
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.cardBackground)
            )
        }
    }

    private func infoRow(icon: String, title: String, value: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundColor(.textSecondary)
                .frame(width: 28, height: 28)

            Text(title)
                .font(.vroomxBodyBold)
                .foregroundColor(.textPrimary)

            Spacer()

            Text(value)
                .font(.vroomxCaption)
                .foregroundColor(.textSecondary)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 12)
    }

    // MARK: - Sign Out Section

    private var signOutSection: some View {
        Button {
            showSignOutAlert = true
        } label: {
            HStack {
                Image(systemName: "rectangle.portrait.and.arrow.right")
                    .font(.system(size: 16, weight: .semibold))
                Text("Sign Out")
                    .font(.vroomxBodyBold)
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.brandDanger)
            )
        }
    }

    // MARK: - Footer

    private var footerSection: some View {
        Text("VroomX Driver v\(Config.appVersion)")
            .font(.vroomxCaption)
            .foregroundColor(.textSecondary)
            .padding(.top, 8)
    }

    // MARK: - Computed Properties

    private var totalTripsCount: Int {
        dataManager.trips.count
    }

    private var activeTripsCount: Int {
        dataManager.trips.filter { [.planned, .in_progress, .at_terminal].contains($0.status) }.count
    }

    private var totalEarnings: Double {
        dataManager.trips
            .filter { $0.status == .completed }
            .compactMap(\.driverPay)
            .reduce(0, +)
    }

    /// Current period earnings: completed trips from the current calendar month.
    private var currentPeriodEarnings: Double {
        let calendar = Calendar.current
        let now = Date()
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"

        return dataManager.trips
            .filter { trip in
                guard trip.status == .completed,
                      let startDate = formatter.date(from: trip.startDate) else {
                    return false
                }
                return calendar.isDate(startDate, equalTo: now, toGranularity: .month)
            }
            .compactMap(\.driverPay)
            .reduce(0, +)
    }

    private var lastSyncText: String {
        if dataManager.isLoading {
            return "Syncing..."
        }
        if !networkMonitor.isConnected {
            return "Offline"
        }
        return "Just now"
    }

    private var biometricIcon: String {
        let context = LAContext()
        _ = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
        switch context.biometryType {
        case .faceID: return "faceid"
        case .touchID: return "touchid"
        case .opticID: return "opticid"
        @unknown default: return "lock.shield.fill"
        }
    }

    private var biometricTitle: String {
        let context = LAContext()
        _ = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
        switch context.biometryType {
        case .faceID: return "Face ID"
        case .touchID: return "Touch ID"
        case .opticID: return "Optic ID"
        @unknown default: return "Biometric Unlock"
        }
    }

    // MARK: - Helpers

    private func driverTypeBadge(_ type: DriverType) -> String {
        switch type {
        case .company: return "Company Driver"
        case .owner_operator: return "Owner Operator"
        }
    }

    private func formattedCurrency(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: amount)) ?? "$0"
    }

    private func loadBiometricState() {
        biometricEnabled = authManager.isBiometricEnabled
    }

    private func handleBiometricToggle(_ enabled: Bool) {
        if enabled {
            Task {
                await authManager.setupBiometric()
                // Re-check state after setup attempt
                biometricEnabled = authManager.isBiometricEnabled
            }
        } else {
            UserDefaults.standard.set(false, forKey: "vroomx_biometric_enabled")
        }
    }

    private func checkNotificationStatus() {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            DispatchQueue.main.async {
                switch settings.authorizationStatus {
                case .authorized, .provisional:
                    notificationStatus = "Enabled"
                case .denied:
                    notificationStatus = "Disabled"
                case .notDetermined:
                    notificationStatus = "Not Set"
                @unknown default:
                    notificationStatus = "Unknown"
                }
            }
        }
    }

    private func loadPendingCounts() {
        Task {
            pendingActionsCount = await PendingActionsQueue.shared.count
            pendingUploadsCount = await InspectionUploadQueue.shared.count
        }
    }

    private func openAppSettings() {
        if let url = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(url)
        }
    }

    private func performSignOut() {
        Task {
            // 1. Tear down DataManager (stop Realtime, clear state)
            DataManager.shared.teardown()

            // 2. Clear pending actions queue
            await PendingActionsQueue.shared.clearQueue()

            // 3. Clear inspection upload queue
            await InspectionUploadQueue.shared.clearQueue()

            // 4. Sign out via AuthManager (Keychain clear, cache clear, Supabase sign out)
            await authManager.logout()
        }
    }
}
