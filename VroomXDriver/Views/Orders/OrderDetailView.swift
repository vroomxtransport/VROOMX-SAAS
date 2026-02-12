import SwiftUI

/// Full order detail view with status updates, ETA submission, contacts, files, and delivery timeline.
/// Primary interaction point for drivers managing individual vehicle orders.
struct OrderDetailView: View {
    let order: VroomXOrder
    var pickupInspection: VehicleInspection?
    var deliveryInspection: VehicleInspection?

    @State private var showStatusConfirmation = false
    @State private var pendingStatus: OrderStatus?
    @State private var isUpdatingStatus = false
    @State private var statusError: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // MARK: - Header
                headerSection

                // MARK: - Vehicle Info Card
                vehicleInfoCard

                // MARK: - Timeline
                timelineSection

                // MARK: - Status Action
                statusActionSection

                // MARK: - Pickup Section
                pickupSection

                // MARK: - Delivery Section
                deliverySection

                // MARK: - Financial Section
                financialSection

                // MARK: - Files Section
                filesSection

                // MARK: - Notes Section
                notesSection

                // MARK: - Inspection Actions
                inspectionActionsSection
            }
            .padding(16)
        }
        .background(Color.appBackground)
        .navigationTitle("Order Detail")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Confirm Status Change", isPresented: $showStatusConfirmation) {
            Button("Cancel", role: .cancel) {
                pendingStatus = nil
            }
            Button("Confirm") {
                if let status = pendingStatus {
                    confirmStatusUpdate(status)
                }
            }
        } message: {
            if let status = pendingStatus {
                Text("Mark this order as \(status.displayName)?")
            }
        }
    }

    // MARK: - Header Section

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(order.orderNumber ?? "No Order #")
                    .font(.vroomxTitleLarge)
                    .foregroundColor(.textPrimary)

                Spacer()

                StatusBadge(status: order.status)
            }

            Text(order.vehicleDescription)
                .font(.vroomxBody)
                .foregroundColor(.textSecondary)

            if let color = order.vehicleColor, !color.isEmpty {
                Text(color)
                    .font(.vroomxCaption)
                    .foregroundColor(.textSecondary)
            }
        }
    }

    // MARK: - Vehicle Info Card

    private var vehicleInfoCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Vehicle Information", systemImage: "car.fill")
                .font(.vroomxTitle)
                .foregroundColor(.textPrimary)

            VStack(alignment: .leading, spacing: 8) {
                if let vin = order.vehicleVin, !vin.isEmpty {
                    DetailRow(label: "VIN", value: vin, isMonospaced: true)
                }

                if let vehicleType = order.vehicleType, !vehicleType.isEmpty {
                    DetailRow(label: "Type", value: vehicleType.capitalized)
                }

                if let color = order.vehicleColor, !color.isEmpty {
                    HStack(spacing: 8) {
                        Text("Color")
                            .font(.vroomxCaption)
                            .foregroundColor(.textSecondary)
                            .frame(width: 80, alignment: .leading)

                        Circle()
                            .fill(colorFromName(color))
                            .frame(width: 12, height: 12)
                            .overlay(
                                Circle()
                                    .stroke(Color.textSecondary.opacity(0.3), lineWidth: 1)
                            )

                        Text(color)
                            .font(.vroomxBody)
                            .foregroundColor(.textPrimary)

                        Spacer()
                    }
                }
            }
        }
        .padding(16)
        .background(Color.cardBackground)
        .cornerRadius(12)
    }

    // MARK: - Timeline Section

    private var timelineSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Delivery Progress", systemImage: "list.bullet")
                .font(.vroomxTitle)
                .foregroundColor(.textPrimary)

            TimelineView(
                order: order,
                pickupInspection: pickupInspection,
                deliveryInspection: deliveryInspection
            )
        }
        .padding(16)
        .background(Color.cardBackground)
        .cornerRadius(12)
    }

    // MARK: - Status Action Section

    @ViewBuilder
    private var statusActionSection: some View {
        if let statusError {
            ErrorBannerView(message: statusError) {
                self.statusError = nil
            }
        }

        switch order.status {
        case .assigned:
            StatusActionButton(
                title: "Mark Picked Up",
                icon: "shippingbox.fill",
                color: .brandPrimary,
                isLoading: isUpdatingStatus
            ) {
                pendingStatus = .picked_up
                showStatusConfirmation = true
            }

        case .picked_up:
            StatusActionButton(
                title: "Mark Delivered",
                icon: "checkmark.circle.fill",
                color: .brandSuccess,
                isLoading: isUpdatingStatus
            ) {
                pendingStatus = .delivered
                showStatusConfirmation = true
            }

        default:
            EmptyView()
        }
    }

    // MARK: - Pickup Section

    private var pickupSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Pickup", systemImage: "arrow.up.circle.fill")
                .font(.vroomxTitle)
                .foregroundColor(.textPrimary)

            VStack(alignment: .leading, spacing: 8) {
                // Address
                if !order.pickupFullAddress.isEmpty {
                    DetailRow(label: "Address", value: order.pickupFullAddress)

                    MapLinkButton(address: order.pickupFullAddress)
                }

                // Contact
                if order.pickupContactName != nil || order.pickupContactPhone != nil {
                    ContactActionSheet(
                        name: order.pickupContactName,
                        phone: order.pickupContactPhone
                    )
                }

                // Scheduled date
                if let pickupDate = order.pickupDate, !pickupDate.isEmpty {
                    DetailRow(label: "Scheduled", value: pickupDate)
                }

                // Actual date
                if let actualDate = order.actualPickupDate {
                    DetailRow(label: "Actual", value: formatTimestamp(actualDate))
                }

                // ETA
                ETAButton(
                    orderId: order.id,
                    etaType: .pickup,
                    currentETA: order.pickupEta
                )
            }
        }
        .padding(16)
        .background(Color.cardBackground)
        .cornerRadius(12)
    }

    // MARK: - Delivery Section

    private var deliverySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Delivery", systemImage: "arrow.down.circle.fill")
                .font(.vroomxTitle)
                .foregroundColor(.textPrimary)

            VStack(alignment: .leading, spacing: 8) {
                // Address
                if !order.deliveryFullAddress.isEmpty {
                    DetailRow(label: "Address", value: order.deliveryFullAddress)

                    MapLinkButton(address: order.deliveryFullAddress)
                }

                // Contact
                if order.deliveryContactName != nil || order.deliveryContactPhone != nil {
                    ContactActionSheet(
                        name: order.deliveryContactName,
                        phone: order.deliveryContactPhone
                    )
                }

                // Scheduled date
                if let deliveryDate = order.deliveryDate, !deliveryDate.isEmpty {
                    DetailRow(label: "Scheduled", value: deliveryDate)
                }

                // Actual date
                if let actualDate = order.actualDeliveryDate {
                    DetailRow(label: "Actual", value: formatTimestamp(actualDate))
                }

                // ETA
                ETAButton(
                    orderId: order.id,
                    etaType: .delivery,
                    currentETA: order.deliveryEta
                )
            }
        }
        .padding(16)
        .background(Color.cardBackground)
        .cornerRadius(12)
    }

    // MARK: - Financial Section

    private var financialSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Financial", systemImage: "dollarsign.circle.fill")
                .font(.vroomxTitle)
                .foregroundColor(.textPrimary)

            VStack(alignment: .leading, spacing: 8) {
                if let revenue = order.revenue {
                    DetailRow(label: "Revenue", value: formatCurrency(revenue))
                }

                if let carrierPay = order.carrierPay {
                    DetailRow(label: "Carrier Pay", value: formatCurrency(carrierPay))
                }

                if let brokerFee = order.brokerFee {
                    DetailRow(label: "Broker Fee", value: formatCurrency(brokerFee))
                }

                if let paymentType = order.paymentType {
                    DetailRow(label: "Payment Type", value: paymentType.displayName)
                }

                if let paymentStatus = order.paymentStatus, !paymentStatus.isEmpty {
                    HStack(spacing: 8) {
                        Text("Payment Status")
                            .font(.vroomxCaption)
                            .foregroundColor(.textSecondary)
                            .frame(width: 80, alignment: .leading)

                        PaymentStatusBadge(status: paymentStatus)

                        Spacer()
                    }
                }
            }
        }
        .padding(16)
        .background(Color.cardBackground)
        .cornerRadius(12)
    }

    // MARK: - Files Section

    private var filesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Files & Documents", systemImage: "doc.fill")
                .font(.vroomxTitle)
                .foregroundColor(.textPrimary)

            FileManagementGrid(orderId: order.id)
        }
        .padding(16)
        .background(Color.cardBackground)
        .cornerRadius(12)
    }

    // MARK: - Notes Section

    @ViewBuilder
    private var notesSection: some View {
        if let notes = order.notes, !notes.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                Label("Notes", systemImage: "note.text")
                    .font(.vroomxTitle)
                    .foregroundColor(.textPrimary)

                Text(notes)
                    .font(.vroomxBody)
                    .foregroundColor(.textPrimary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(16)
            .background(Color.cardBackground)
            .cornerRadius(12)
        }
    }

    // MARK: - Inspection Actions Section

    private var inspectionActionsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Inspections", systemImage: "checklist")
                .font(.vroomxTitle)
                .foregroundColor(.textPrimary)

            VStack(spacing: 10) {
                // Pickup inspection
                if let inspection = pickupInspection {
                    if inspection.status == .completed {
                        InspectionRow(
                            title: "Pickup Inspection",
                            subtitle: "Completed",
                            icon: "checkmark.circle.fill",
                            color: .brandSuccess
                        )
                    } else {
                        InspectionRow(
                            title: "Pickup Inspection",
                            subtitle: "In Progress",
                            icon: "clock.fill",
                            color: .brandWarning
                        )
                    }
                } else if order.status == .assigned || order.status == .picked_up {
                    // Placeholder NavigationLink - InspectionView built in Plans 08-09
                    InspectionActionButton(
                        title: "Start Pickup Inspection",
                        icon: "camera.fill",
                        color: .brandPrimary
                    )
                }

                // Delivery inspection
                if let inspection = deliveryInspection {
                    if inspection.status == .completed {
                        InspectionRow(
                            title: "Delivery Inspection",
                            subtitle: "Completed",
                            icon: "checkmark.circle.fill",
                            color: .brandSuccess
                        )
                    } else {
                        InspectionRow(
                            title: "Delivery Inspection",
                            subtitle: "In Progress",
                            icon: "clock.fill",
                            color: .brandWarning
                        )
                    }
                } else if order.status == .delivered {
                    InspectionActionButton(
                        title: "Start Delivery Inspection",
                        icon: "camera.fill",
                        color: .brandSuccess
                    )
                }
            }
        }
        .padding(16)
        .background(Color.cardBackground)
        .cornerRadius(12)
    }

    // MARK: - Status Update

    private func confirmStatusUpdate(_ status: OrderStatus) {
        isUpdatingStatus = true
        statusError = nil

        Task {
            do {
                try await DataManager.shared.updateOrderStatus(orderId: order.id, status: status)
                await MainActor.run {
                    isUpdatingStatus = false
                    pendingStatus = nil
                }
            } catch {
                await MainActor.run {
                    isUpdatingStatus = false
                    statusError = "Failed to update status: \(error.localizedDescription)"
                    pendingStatus = nil
                }
            }
        }
    }

    // MARK: - Helpers

    private func formatTimestamp(_ isoString: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        if let date = formatter.date(from: isoString) {
            return Self.displayFormatter.string(from: date)
        }

        formatter.formatOptions = [.withInternetDateTime]
        if let date = formatter.date(from: isoString) {
            return Self.displayFormatter.string(from: date)
        }

        return isoString
    }

    private func formatCurrency(_ value: Double) -> String {
        String(format: "$%.2f", value)
    }

    private func colorFromName(_ name: String) -> Color {
        switch name.lowercased() {
        case "red": return .red
        case "blue": return .blue
        case "black": return Color(hex: "1A1A1A")
        case "white": return Color(hex: "F0F0F0")
        case "silver", "gray", "grey": return .gray
        case "green": return .green
        case "yellow", "gold": return .yellow
        case "orange": return .orange
        case "brown": return .brown
        case "beige", "tan": return Color(hex: "D2B48C")
        default: return .gray
        }
    }

    private static let displayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }()
}

// MARK: - Status Badge

/// Colored pill badge showing order status.
private struct StatusBadge: View {
    let status: OrderStatus

    var body: some View {
        Text(status.displayName)
            .font(.vroomxCaptionSmall)
            .fontWeight(.bold)
            .textCase(.uppercase)
            .foregroundColor(.white)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(status.color)
            .cornerRadius(12)
    }
}

// MARK: - Payment Status Badge

/// Colored badge for payment status.
private struct PaymentStatusBadge: View {
    let status: String

    var body: some View {
        Text(status.capitalized)
            .font(.vroomxCaptionSmall)
            .fontWeight(.bold)
            .foregroundColor(.white)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(statusColor)
            .cornerRadius(8)
    }

    private var statusColor: Color {
        switch status.lowercased() {
        case "paid": return .brandSuccess
        case "unpaid": return .brandWarning
        case "overdue": return .brandDanger
        case "partial": return .brandAccent
        default: return .textSecondary
        }
    }
}

// MARK: - Detail Row

/// A label-value row for displaying order details.
private struct DetailRow: View {
    let label: String
    let value: String
    var isMonospaced: Bool = false

    var body: some View {
        HStack(spacing: 8) {
            Text(label)
                .font(.vroomxCaption)
                .foregroundColor(.textSecondary)
                .frame(width: 80, alignment: .leading)

            Text(value)
                .font(isMonospaced ? .vroomxMono : .vroomxBody)
                .foregroundColor(.textPrimary)
                .lineLimit(2)

            Spacer()
        }
    }
}

// MARK: - Status Action Button

/// Large action button for status transitions (e.g., "Mark Picked Up").
private struct StatusActionButton: View {
    let title: String
    let icon: String
    let color: Color
    let isLoading: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(.white)
                        .scaleEffect(0.8)
                } else {
                    Image(systemName: icon)
                        .font(.system(size: 16, weight: .bold))
                }

                Text(isLoading ? "Updating..." : title)
                    .font(.vroomxBodyBold)
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(color)
            .cornerRadius(12)
        }
        .disabled(isLoading)
    }
}

// MARK: - Inspection Row

/// Row showing a completed or in-progress inspection.
private struct InspectionRow: View {
    let title: String
    let subtitle: String
    let icon: String
    let color: Color

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 18))
                .foregroundColor(color)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.vroomxBodyBold)
                    .foregroundColor(.textPrimary)
                Text(subtitle)
                    .font(.vroomxCaption)
                    .foregroundColor(.textSecondary)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(.textSecondary)
        }
        .padding(12)
        .background(color.opacity(0.08))
        .cornerRadius(10)
    }
}

// MARK: - Inspection Action Button

/// Button to start a new inspection. Placeholder until InspectionView is built in Plans 08-09.
private struct InspectionActionButton: View {
    let title: String
    let icon: String
    let color: Color

    var body: some View {
        // Placeholder: NavigationLink to InspectionView will replace this in Plans 08-09
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 18))
                .foregroundColor(color)

            Text(title)
                .font(.vroomxBodyBold)
                .foregroundColor(.textPrimary)

            Spacer()

            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(.textSecondary)
        }
        .padding(12)
        .background(color.opacity(0.08))
        .cornerRadius(10)
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        OrderDetailView(
            order: VroomXOrder(
                id: "1",
                tenantId: "t1",
                orderNumber: "ORD-001",
                brokerId: nil,
                driverId: "d1",
                tripId: "trip-1",
                vehicleVin: "1HGBH41JXMN109186",
                vehicleYear: 2024,
                vehicleMake: "Toyota",
                vehicleModel: "Camry",
                vehicleType: "sedan",
                vehicleColor: "Silver",
                status: .assigned,
                cancelledReason: nil,
                pickupLocation: "123 Main St",
                pickupCity: "Dallas",
                pickupState: "TX",
                pickupZip: "75201",
                pickupContactName: "John Doe",
                pickupContactPhone: "555-123-4567",
                pickupDate: "2024-03-15",
                deliveryLocation: "456 Oak Ave",
                deliveryCity: "Houston",
                deliveryState: "TX",
                deliveryZip: "77001",
                deliveryContactName: "Jane Smith",
                deliveryContactPhone: "555-987-6543",
                deliveryDate: "2024-03-17",
                actualPickupDate: nil,
                actualDeliveryDate: nil,
                pickupEta: nil,
                deliveryEta: "2024-03-17T14:30:00Z",
                revenue: 1200.00,
                carrierPay: 900.00,
                brokerFee: 300.00,
                paymentType: .COD,
                paymentStatus: "unpaid",
                invoiceDate: nil,
                amountPaid: nil,
                notes: "Handle with care. Customer prefers morning delivery.",
                createdAt: "2024-03-10T08:00:00Z",
                updatedAt: "2024-03-15T10:30:00Z"
            )
        )
    }
}
