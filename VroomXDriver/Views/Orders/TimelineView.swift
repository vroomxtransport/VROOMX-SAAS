import SwiftUI

/// 7-step vertical delivery timeline showing order progress.
/// Steps: Order Created -> Assigned -> Pickup Inspection -> Picked Up -> In Transit -> Delivery Inspection -> Delivered
struct TimelineView: View {
    let order: VroomXOrder
    var pickupInspection: VehicleInspection?
    var deliveryInspection: VehicleInspection?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(steps.enumerated()), id: \.element.id) { index, step in
                TimelineStepRow(
                    step: step,
                    isLast: index == steps.count - 1
                )
            }
        }
    }

    // MARK: - Steps

    private var steps: [TimelineStep] {
        let statusLevel = order.status.level

        return [
            TimelineStep(
                id: "created",
                title: "Order Created",
                timestamp: formattedDate(order.createdAt),
                state: .complete
            ),
            TimelineStep(
                id: "assigned",
                title: "Assigned to Trip",
                timestamp: order.tripId != nil ? "Trip assigned" : nil,
                state: order.tripId != nil ? .complete : (statusLevel >= OrderStatus.assigned.level ? .complete : .pending)
            ),
            TimelineStep(
                id: "pickup_inspection",
                title: "Pickup Inspection",
                timestamp: pickupInspection?.completedAt.flatMap(formattedDate),
                state: pickupInspection != nil ? .complete : (statusLevel >= OrderStatus.assigned.level && statusLevel < OrderStatus.picked_up.level ? .active : .pending)
            ),
            TimelineStep(
                id: "picked_up",
                title: "Picked Up",
                timestamp: order.actualPickupDate.flatMap(formattedDate),
                state: statusLevel >= OrderStatus.picked_up.level ? .complete : .pending
            ),
            TimelineStep(
                id: "in_transit",
                title: "In Transit",
                timestamp: nil,
                state: order.status == .picked_up ? .active : (statusLevel > OrderStatus.picked_up.level ? .complete : .pending)
            ),
            TimelineStep(
                id: "delivery_inspection",
                title: "Delivery Inspection",
                timestamp: deliveryInspection?.completedAt.flatMap(formattedDate),
                state: deliveryInspection != nil ? .complete : (order.status == .delivered ? .active : .pending)
            ),
            TimelineStep(
                id: "delivered",
                title: "Delivered",
                timestamp: order.actualDeliveryDate.flatMap(formattedDate),
                state: statusLevel >= OrderStatus.delivered.level ? .complete : .pending
            )
        ]
    }

    // MARK: - Date Formatting

    private func formattedDate(_ isoString: String) -> String {
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        if let date = isoFormatter.date(from: isoString) {
            return Self.displayFormatter.string(from: date)
        }

        // Try without fractional seconds
        isoFormatter.formatOptions = [.withInternetDateTime]
        if let date = isoFormatter.date(from: isoString) {
            return Self.displayFormatter.string(from: date)
        }

        return isoString
    }

    private static let displayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }()
}

// MARK: - Timeline Step Model

/// Represents a single step in the delivery timeline.
struct TimelineStep: Identifiable {
    let id: String
    let title: String
    let timestamp: String?
    let state: TimelineStepState
}

/// State of a timeline step.
enum TimelineStepState {
    case complete
    case active
    case pending

    var circleColor: Color {
        switch self {
        case .complete: return .brandSuccess
        case .active: return .brandPrimary
        case .pending: return .textSecondary.opacity(0.4)
        }
    }

    var iconName: String? {
        switch self {
        case .complete: return "checkmark"
        case .active: return nil
        case .pending: return nil
        }
    }
}

// MARK: - Timeline Step Row

/// A single row in the vertical timeline with circle indicator, connecting line, title, and timestamp.
private struct TimelineStepRow: View {
    let step: TimelineStep
    let isLast: Bool

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            // Circle + connecting line
            VStack(spacing: 0) {
                ZStack {
                    Circle()
                        .fill(step.state.circleColor)
                        .frame(width: 24, height: 24)

                    if let iconName = step.state.iconName {
                        Image(systemName: iconName)
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(.white)
                    } else if step.state == .active {
                        Circle()
                            .fill(Color.white)
                            .frame(width: 8, height: 8)
                    }
                }

                if !isLast {
                    Rectangle()
                        .fill(step.state == .complete ? Color.brandSuccess.opacity(0.5) : Color.textSecondary.opacity(0.2))
                        .frame(width: 2)
                        .frame(height: 28)
                }
            }

            // Title and timestamp
            VStack(alignment: .leading, spacing: 2) {
                Text(step.title)
                    .font(.vroomxBodyBold)
                    .foregroundColor(step.state == .pending ? .textSecondary : .textPrimary)

                if let timestamp = step.timestamp {
                    Text(timestamp)
                        .font(.vroomxCaption)
                        .foregroundColor(.textSecondary)
                }
            }
            .padding(.top, 2)

            Spacer()
        }
    }
}

// MARK: - Order Status Level Extension

extension OrderStatus {
    /// Numeric level for comparing order progress.
    var level: Int {
        switch self {
        case .new: return 0
        case .assigned: return 1
        case .picked_up: return 2
        case .delivered: return 3
        case .invoiced: return 4
        case .paid: return 5
        case .cancelled: return -1
        }
    }
}

#Preview {
    let sampleOrder = VroomXOrder(
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
        status: .picked_up,
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
        actualPickupDate: "2024-03-15T10:30:00Z",
        actualDeliveryDate: nil,
        pickupEta: nil,
        deliveryEta: nil,
        revenue: 1200.00,
        carrierPay: 900.00,
        brokerFee: 300.00,
        paymentType: .COD,
        paymentStatus: "unpaid",
        invoiceDate: nil,
        amountPaid: nil,
        notes: "Handle with care",
        createdAt: "2024-03-10T08:00:00Z",
        updatedAt: "2024-03-15T10:30:00Z"
    )

    ScrollView {
        TimelineView(order: sampleOrder)
            .padding()
    }
    .background(Color.appBackground)
}
