import SwiftUI

/// Messages tab displaying the driver's notification history.
/// Groups notifications by time period (Today, This Week, Earlier)
/// with unread indicators, type icons, and tap-to-mark-read.
struct MessagesView: View {
    @ObservedObject private var dataManager = DataManager.shared
    @ObservedObject private var notificationManager = NotificationManager.shared

    /// Filter selection for notification types.
    @State private var selectedFilter: MessageFilter = .all

    var body: some View {
        NavigationStack {
            Group {
                if dataManager.isLoading && dataManager.notifications.isEmpty {
                    LoadingView(message: "Loading messages...")
                } else if filteredNotifications.isEmpty {
                    emptyStateView
                } else {
                    notificationListView
                }
            }
            .background(Color.appBackground)
            .navigationTitle("Messages")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    if notificationManager.unreadCount > 0 {
                        Button("Mark All Read") {
                            Task { await markAllAsRead() }
                        }
                        .font(.vroomxCaption)
                        .foregroundColor(.brandPrimary)
                    }
                }
            }
            .refreshable {
                await dataManager.fetchNotifications()
                await notificationManager.updateBadgeCount()
            }
            .onChange(of: dataManager.notifications) { _, _ in
                notificationManager.updateBadgeFromLocal()
            }
        }
    }

    // MARK: - Computed Properties

    /// Notifications filtered by the selected filter.
    private var filteredNotifications: [DriverNotification] {
        switch selectedFilter {
        case .all:
            return dataManager.notifications
        case .unread:
            return dataManager.notifications.filter { !$0.isRead }
        case .tripAssignment:
            return dataManager.notifications.filter { $0.notificationType == .trip_assignment }
        case .statusChange:
            return dataManager.notifications.filter { $0.notificationType == .status_change }
        }
    }

    /// Notifications from today.
    private var todayNotifications: [DriverNotification] {
        filteredNotifications.filter { isToday($0.createdAt) }
    }

    /// Notifications from this week (excluding today).
    private var thisWeekNotifications: [DriverNotification] {
        filteredNotifications.filter { isThisWeek($0.createdAt) && !isToday($0.createdAt) }
    }

    /// Notifications older than this week.
    private var earlierNotifications: [DriverNotification] {
        filteredNotifications.filter { !isThisWeek($0.createdAt) }
    }

    // MARK: - Notification List

    private var notificationListView: some View {
        VStack(spacing: 0) {
            filterBar
                .padding(.horizontal, 16)
                .padding(.vertical, 8)

            ScrollView {
                LazyVStack(spacing: 0) {
                    if !todayNotifications.isEmpty {
                        sectionHeader("Today")
                        ForEach(todayNotifications) { notification in
                            NotificationRow(notification: notification) {
                                await handleTap(notification)
                            }
                        }
                    }

                    if !thisWeekNotifications.isEmpty {
                        sectionHeader("This Week")
                        ForEach(thisWeekNotifications) { notification in
                            NotificationRow(notification: notification) {
                                await handleTap(notification)
                            }
                        }
                    }

                    if !earlierNotifications.isEmpty {
                        sectionHeader("Earlier")
                        ForEach(earlierNotifications) { notification in
                            NotificationRow(notification: notification) {
                                await handleTap(notification)
                            }
                        }
                    }
                }
                .padding(.bottom, 20)
            }
        }
    }

    // MARK: - Filter Bar

    private var filterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(MessageFilter.allCases) { filter in
                    FilterChip(
                        title: filter.displayName,
                        isSelected: selectedFilter == filter
                    ) {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            selectedFilter = filter
                        }
                    }
                }
            }
        }
    }

    // MARK: - Section Header

    private func sectionHeader(_ title: String) -> some View {
        HStack {
            Text(title)
                .font(.vroomxCaption)
                .foregroundColor(.textSecondary)
                .textCase(.uppercase)
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.top, 16)
        .padding(.bottom, 4)
    }

    // MARK: - Empty State

    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "message.fill")
                .font(.system(size: 48))
                .foregroundColor(.brandPrimary.opacity(0.4))

            Text("No messages yet")
                .font(.vroomxTitleMedium)
                .foregroundColor(.textPrimary)

            Text("Notifications from dispatch will appear here.")
                .font(.vroomxBody)
                .foregroundColor(.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.appBackground)
    }

    // MARK: - Actions

    /// Handles tapping on a notification: marks as read and posts navigation.
    private func handleTap(_ notification: DriverNotification) async {
        // Mark as read if unread
        if !notification.isRead {
            try? await dataManager.markNotificationRead(id: notification.id)
            await notificationManager.updateBadgeCount()
        }

        // Parse the data JSON for trip_id or order_id
        if let dataString = notification.data,
           let jsonData = dataString.data(using: .utf8),
           let json = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] {

            if let tripId = json["trip_id"] as? String {
                NotificationCenter.default.post(
                    name: .navigateToTrip,
                    object: nil,
                    userInfo: ["tripId": tripId]
                )
            } else if let orderId = json["order_id"] as? String {
                NotificationCenter.default.post(
                    name: .navigateToOrder,
                    object: nil,
                    userInfo: ["orderId": orderId]
                )
            }
        }
    }

    /// Marks all visible notifications as read.
    private func markAllAsRead() async {
        let unread = dataManager.notifications.filter { !$0.isRead }
        for notification in unread {
            try? await dataManager.markNotificationRead(id: notification.id)
        }
        await notificationManager.updateBadgeCount()
    }

    // MARK: - Date Helpers

    private func isToday(_ dateString: String) -> Bool {
        guard let date = parseDate(dateString) else { return false }
        return Calendar.current.isDateInToday(date)
    }

    private func isThisWeek(_ dateString: String) -> Bool {
        guard let date = parseDate(dateString) else { return false }
        return Calendar.current.isDate(date, equalTo: Date(), toGranularity: .weekOfYear)
    }

    private func parseDate(_ dateString: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: dateString) { return date }

        // Fallback without fractional seconds
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: dateString)
    }
}

// MARK: - Message Filter

/// Filter options for the Messages tab.
enum MessageFilter: String, CaseIterable, Identifiable {
    case all
    case unread
    case tripAssignment
    case statusChange

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .all: return "All"
        case .unread: return "Unread"
        case .tripAssignment: return "Trips"
        case .statusChange: return "Status"
        }
    }
}

// MARK: - Filter Chip

/// Small pill-shaped filter toggle button.
private struct FilterChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.vroomxCaptionSmall)
                .fontWeight(isSelected ? .bold : .medium)
                .foregroundColor(isSelected ? .brandPrimary : .textSecondary)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(
                    Capsule()
                        .fill(isSelected
                            ? Color.brandPrimary.opacity(0.12)
                            : Color.cardBackground
                        )
                )
                .overlay(
                    Capsule()
                        .strokeBorder(
                            isSelected ? Color.brandPrimary.opacity(0.3) : Color.clear,
                            lineWidth: 1
                        )
                )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Notification Row

/// Single notification row with type icon, title, body, time, and unread indicator.
struct NotificationRow: View {
    let notification: DriverNotification
    let onTap: () async -> Void

    /// Tracks whether the body is expanded (for notifications without navigation targets).
    @State private var isExpanded: Bool = false

    var body: some View {
        Button {
            Task { await onTap() }
        } label: {
            HStack(alignment: .top, spacing: 12) {
                // Unread dot
                Circle()
                    .fill(notification.isRead ? Color.clear : Color.brandPrimary)
                    .frame(width: 8, height: 8)
                    .padding(.top, 6)

                // Type icon
                notificationIcon
                    .frame(width: 36, height: 36)

                // Content
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(notification.title)
                            .font(notification.isRead ? .vroomxBody : .vroomxBodyBold)
                            .foregroundColor(.textPrimary)
                            .lineLimit(1)

                        Spacer()

                        Text(timeAgo(notification.createdAt))
                            .font(.vroomxCaptionSmall)
                            .foregroundColor(.textSecondary)
                    }

                    Text(notification.body)
                        .font(.vroomxCaption)
                        .foregroundColor(.textSecondary)
                        .lineLimit(isExpanded ? nil : 2)
                        .fixedSize(horizontal: false, vertical: isExpanded)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(Color.cardBackground)
        }
        .buttonStyle(.plain)

        Divider()
            .padding(.leading, 72)
    }

    // MARK: - Icon

    private var notificationIcon: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 10)
                .fill(iconBackgroundColor.opacity(0.15))

            Image(systemName: notification.notificationType.icon)
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(iconBackgroundColor)
        }
    }

    private var iconBackgroundColor: Color {
        switch notification.notificationType {
        case .trip_assignment:
            return .brandPrimary
        case .status_change:
            return .brandAccent
        case .dispatch_message:
            return .brandSuccess
        case .urgent:
            return .brandDanger
        }
    }

    // MARK: - Time Ago

    private func timeAgo(_ dateString: String) -> String {
        guard let date = parseDate(dateString) else { return "" }

        let now = Date()
        let interval = now.timeIntervalSince(date)

        if interval < 60 {
            return "Just now"
        } else if interval < 3600 {
            let minutes = Int(interval / 60)
            return "\(minutes)m ago"
        } else if interval < 86400 {
            let hours = Int(interval / 3600)
            return "\(hours)h ago"
        } else if Calendar.current.isDateInYesterday(date) {
            return "Yesterday"
        } else {
            let formatter = DateFormatter()
            formatter.dateFormat = "MMM d"
            return formatter.string(from: date)
        }
    }

    private func parseDate(_ dateString: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: dateString) { return date }

        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: dateString)
    }
}

// MARK: - Preview

#Preview {
    MessagesView()
}
