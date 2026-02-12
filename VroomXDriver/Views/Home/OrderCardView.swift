import SwiftUI

/// Displays a single order card with vehicle info, route details, status badge,
/// and context-aware quick action buttons.
/// Designed for use in HomeView's order list.
struct OrderCardView: View {
    let order: VroomXOrder
    @ObservedObject private var dataManager = DataManager.shared

    @State private var isPerformingAction = false

    var body: some View {
        NavigationLink(value: order.id) {
            VStack(alignment: .leading, spacing: 12) {
                // Top row: vehicle description + status badge
                topRow

                // Vehicle details: color + VIN
                vehicleDetails

                // Route: pickup and delivery
                routeSection

                // Contact info (if available)
                contactSection

                // Bottom row: order number + quick action
                bottomRow
            }
            .padding(14)
            .background(Color.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .strokeBorder(Color.textSecondary.opacity(0.12), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Top Row

    private var topRow: some View {
        HStack(alignment: .top) {
            Text(order.vehicleDescription)
                .font(.vroomxTitle)
                .foregroundColor(.textPrimary)
                .lineLimit(1)

            Spacer()

            StatusBadge(status: order.status)
        }
    }

    // MARK: - Vehicle Details

    @ViewBuilder
    private var vehicleDetails: some View {
        HStack(spacing: 12) {
            if let color = order.vehicleColor, !color.isEmpty {
                HStack(spacing: 4) {
                    Circle()
                        .fill(colorForName(color))
                        .frame(width: 10, height: 10)
                    Text(color.capitalized)
                        .font(.vroomxCaption)
                        .foregroundColor(.textSecondary)
                }
            }

            if let vin = order.vehicleVin, vin.count >= 8 {
                HStack(spacing: 4) {
                    Image(systemName: "barcode")
                        .font(.system(size: 10))
                        .foregroundColor(.textSecondary)
                    Text("..." + vin.suffix(8))
                        .font(.vroomxCaption)
                        .foregroundColor(.textSecondary)
                        .monospaced()
                }
            }
        }
    }

    // MARK: - Route Section

    private var routeSection: some View {
        VStack(spacing: 8) {
            // Pickup
            RouteRow(
                icon: "arrow.up.circle.fill",
                iconColor: .brandWarning,
                location: pickupLocationText,
                date: order.pickupDate,
                label: "Pickup"
            )

            // Divider line
            HStack(spacing: 0) {
                Rectangle()
                    .fill(Color.textSecondary.opacity(0.15))
                    .frame(width: 1, height: 12)
                    .padding(.leading, 9)
                Spacer()
            }

            // Delivery
            RouteRow(
                icon: "mappin.circle.fill",
                iconColor: .brandSuccess,
                location: deliveryLocationText,
                date: order.deliveryDate,
                label: "Delivery"
            )
        }
    }

    private var pickupLocationText: String {
        let parts = [order.pickupCity, order.pickupState].compactMap { $0 }.filter { !$0.isEmpty }
        return parts.isEmpty ? "Pickup location TBD" : parts.joined(separator: ", ")
    }

    private var deliveryLocationText: String {
        let parts = [order.deliveryCity, order.deliveryState].compactMap { $0 }.filter { !$0.isEmpty }
        return parts.isEmpty ? "Delivery location TBD" : parts.joined(separator: ", ")
    }

    // MARK: - Contact Section

    @ViewBuilder
    private var contactSection: some View {
        if let name = order.pickupContactName, !name.isEmpty {
            HStack(spacing: 6) {
                Image(systemName: "person.fill")
                    .font(.system(size: 10))
                    .foregroundColor(.textSecondary)

                Text(name)
                    .font(.vroomxCaption)
                    .foregroundColor(.textSecondary)

                if let phone = order.pickupContactPhone, !phone.isEmpty {
                    Text("--")
                        .font(.vroomxCaption)
                        .foregroundColor(.textSecondary.opacity(0.5))

                    Button {
                        callPhone(phone)
                    } label: {
                        HStack(spacing: 3) {
                            Image(systemName: "phone.fill")
                                .font(.system(size: 9))
                            Text(phone)
                                .font(.vroomxCaption)
                        }
                        .foregroundColor(.brandPrimary)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: - Bottom Row

    private var bottomRow: some View {
        HStack {
            // Order number
            if let orderNumber = order.orderNumber, !orderNumber.isEmpty {
                Text("#\(orderNumber)")
                    .font(.vroomxCaptionSmall)
                    .foregroundColor(.textSecondary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Color.textSecondary.opacity(0.08))
                    .clipShape(Capsule())
            }

            Spacer()

            // Quick action button based on status
            quickActionButton
        }
    }

    @ViewBuilder
    private var quickActionButton: some View {
        switch order.status {
        case .new, .assigned:
            ActionButton(
                title: "Start Pickup",
                icon: "arrow.up.circle",
                color: .brandPrimary,
                isLoading: isPerformingAction
            ) {
                await performStatusUpdate(.picked_up)
            }

        case .picked_up:
            ActionButton(
                title: "Mark Delivered",
                icon: "checkmark.circle",
                color: .brandSuccess,
                isLoading: isPerformingAction
            ) {
                await performStatusUpdate(.delivered)
            }

        case .delivered:
            ActionButton(
                title: "View Details",
                icon: "chevron.right",
                color: .textSecondary,
                isLoading: false,
                isOutline: true
            ) {
                // Navigation handled by NavigationLink wrapper
            }

        default:
            EmptyView()
        }
    }

    // MARK: - Actions

    private func performStatusUpdate(_ newStatus: OrderStatus) async {
        isPerformingAction = true
        defer { isPerformingAction = false }

        do {
            try await dataManager.updateOrderStatus(orderId: order.id, status: newStatus)
        } catch {
            print("[OrderCardView] Status update failed: \(error.localizedDescription)")
        }
    }

    private func callPhone(_ phone: String) {
        let cleaned = phone.replacingOccurrences(of: "[^0-9+]", with: "", options: .regularExpression)
        if let url = URL(string: "tel://\(cleaned)") {
            UIApplication.shared.open(url)
        }
    }

    /// Maps common vehicle color names to SwiftUI colors for the color dot.
    private func colorForName(_ name: String) -> Color {
        switch name.lowercased() {
        case "black": return .black
        case "white": return .white
        case "silver", "gray", "grey": return .gray
        case "red": return .red
        case "blue": return .blue
        case "green": return .green
        case "yellow", "gold": return .yellow
        case "orange": return .orange
        case "brown": return .brown
        case "beige", "tan": return Color(hex: "C8AD7F")
        case "purple", "violet": return .purple
        default: return .gray
        }
    }
}

// MARK: - Status Badge

/// Colored pill displaying the order status name.
private struct StatusBadge: View {
    let status: OrderStatus

    var body: some View {
        Text(status.displayName)
            .font(.vroomxCaptionSmall)
            .fontWeight(.semibold)
            .foregroundColor(status.color)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(status.color.opacity(0.12))
            .clipShape(Capsule())
    }
}

// MARK: - Route Row

/// A single pickup/delivery line with icon, location, and date.
private struct RouteRow: View {
    let icon: String
    let iconColor: Color
    let location: String
    let date: String?
    let label: String

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 18))
                .foregroundColor(iconColor)
                .frame(width: 20)

            VStack(alignment: .leading, spacing: 2) {
                Text(location)
                    .font(.vroomxBodyBold)
                    .foregroundColor(.textPrimary)
                    .lineLimit(1)

                if let date, !date.isEmpty {
                    HStack(spacing: 4) {
                        Image(systemName: "calendar")
                            .font(.system(size: 9))
                        Text(formattedDate(date))
                            .font(.vroomxCaptionSmall)
                    }
                    .foregroundColor(.textSecondary)
                }
            }

            Spacer()
        }
    }

    /// Format an ISO date string to a short readable date (e.g. "Feb 12, 2026").
    private func formattedDate(_ isoString: String) -> String {
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        // Try with fractional seconds first, then without
        if let date = isoFormatter.date(from: isoString) {
            return shortFormatter.string(from: date)
        }

        isoFormatter.formatOptions = [.withInternetDateTime]
        if let date = isoFormatter.date(from: isoString) {
            return shortFormatter.string(from: date)
        }

        // Try as date-only (YYYY-MM-DD)
        let dateOnly = DateFormatter()
        dateOnly.dateFormat = "yyyy-MM-dd"
        if let date = dateOnly.date(from: isoString) {
            return shortFormatter.string(from: date)
        }

        return isoString
    }

    private var shortFormatter: DateFormatter {
        let f = DateFormatter()
        f.dateFormat = "MMM d, yyyy"
        return f
    }
}

// MARK: - Action Button

/// Compact action button with optional loading state and outline variant.
private struct ActionButton: View {
    let title: String
    let icon: String
    let color: Color
    let isLoading: Bool
    var isOutline: Bool = false
    let action: () async -> Void

    var body: some View {
        Button {
            Task {
                await action()
            }
        } label: {
            HStack(spacing: 4) {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .scaleEffect(0.6)
                        .tint(isOutline ? color : .white)
                } else {
                    Image(systemName: icon)
                        .font(.system(size: 10, weight: .semibold))
                }

                Text(title)
                    .font(.vroomxCaptionSmall)
                    .fontWeight(.semibold)
            }
            .foregroundColor(isOutline ? color : .white)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(
                Group {
                    if isOutline {
                        Capsule()
                            .strokeBorder(color.opacity(0.4), lineWidth: 1)
                    } else {
                        Capsule()
                            .fill(color)
                    }
                }
            )
        }
        .buttonStyle(.plain)
        .disabled(isLoading)
    }
}

#Preview {
    NavigationStack {
        ScrollView {
            VStack(spacing: 12) {
                OrderCardView(order: VroomXOrder(
                    id: "1",
                    tenantId: "t1",
                    orderNumber: "ORD-001",
                    brokerId: nil,
                    driverId: "d1",
                    tripId: nil,
                    vehicleVin: "1HGBH41JXMN109186",
                    vehicleYear: 2024,
                    vehicleMake: "Toyota",
                    vehicleModel: "Camry",
                    vehicleType: "sedan",
                    vehicleColor: "Blue",
                    status: .assigned,
                    cancelledReason: nil,
                    pickupLocation: "123 Main St",
                    pickupCity: "Dallas",
                    pickupState: "TX",
                    pickupZip: "75201",
                    pickupContactName: "John Doe",
                    pickupContactPhone: "(214) 555-0123",
                    pickupDate: "2026-02-15",
                    deliveryLocation: "456 Oak Ave",
                    deliveryCity: "Houston",
                    deliveryState: "TX",
                    deliveryZip: "77001",
                    deliveryContactName: nil,
                    deliveryContactPhone: nil,
                    deliveryDate: "2026-02-18",
                    actualPickupDate: nil,
                    actualDeliveryDate: nil,
                    pickupEta: nil,
                    deliveryEta: nil,
                    revenue: 850.0,
                    carrierPay: 700.0,
                    brokerFee: 150.0,
                    paymentType: .COP,
                    paymentStatus: nil,
                    invoiceDate: nil,
                    amountPaid: nil,
                    notes: nil,
                    createdAt: "2026-02-10T10:00:00Z",
                    updatedAt: "2026-02-10T10:00:00Z"
                ))
            }
            .padding(16)
        }
        .background(Color.appBackground)
    }
}
