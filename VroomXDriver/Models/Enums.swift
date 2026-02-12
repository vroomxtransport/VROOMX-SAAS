import SwiftUI

// MARK: - Order Status

/// Matches VroomX database `order_status` enum.
enum OrderStatus: String, Codable, CaseIterable, Identifiable {
    case new
    case assigned
    case picked_up
    case delivered
    case invoiced
    case paid
    case cancelled

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .new: return "New"
        case .assigned: return "Assigned"
        case .picked_up: return "Picked Up"
        case .delivered: return "Delivered"
        case .invoiced: return "Invoiced"
        case .paid: return "Paid"
        case .cancelled: return "Cancelled"
        }
    }

    var color: Color {
        switch self {
        case .new: return .brandPrimary
        case .assigned: return .brandAccent
        case .picked_up: return .brandWarning
        case .delivered: return .brandSuccess
        case .invoiced: return .textSecondary
        case .paid: return .brandSuccess
        case .cancelled: return .brandDanger
        }
    }
}

// MARK: - Trip Status

/// Matches VroomX database `trip_status` enum.
enum TripStatus: String, Codable, CaseIterable, Identifiable {
    case planned
    case in_progress
    case at_terminal
    case completed

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .planned: return "Planned"
        case .in_progress: return "In Progress"
        case .at_terminal: return "At Terminal"
        case .completed: return "Completed"
        }
    }

    var color: Color {
        switch self {
        case .planned: return .brandPrimary
        case .in_progress: return .brandWarning
        case .at_terminal: return .brandAccent
        case .completed: return .brandSuccess
        }
    }
}

// MARK: - Payment Type

/// Matches VroomX database `payment_type` enum.
enum PaymentType: String, Codable, CaseIterable, Identifiable {
    case COD
    case COP
    case CHECK
    case BILL
    case SPLIT

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .COD: return "COD"
        case .COP: return "COP"
        case .CHECK: return "Check"
        case .BILL: return "Bill"
        case .SPLIT: return "Split"
        }
    }
}

// MARK: - Expense Category

/// Matches VroomX database `expense_category` enum.
enum ExpenseCategory: String, Codable, CaseIterable, Identifiable {
    case fuel
    case tolls
    case repairs
    case lodging
    case misc

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .fuel: return "Fuel"
        case .tolls: return "Tolls"
        case .repairs: return "Repairs"
        case .lodging: return "Lodging"
        case .misc: return "Misc"
        }
    }

    var icon: String {
        switch self {
        case .fuel: return "fuelpump.fill"
        case .tolls: return "road.lanes"
        case .repairs: return "wrench.fill"
        case .lodging: return "bed.double.fill"
        case .misc: return "ellipsis.circle.fill"
        }
    }
}

// MARK: - Driver Type

/// Matches VroomX database `driver_type` enum.
enum DriverType: String, Codable, CaseIterable, Identifiable {
    case company
    case owner_operator

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .company: return "Company"
        case .owner_operator: return "Owner Operator"
        }
    }
}

// MARK: - Driver Pay Type

/// Matches VroomX database `driver_pay_type` enum.
/// Includes `per_car` added in migration 00003.
enum DriverPayType: String, Codable, CaseIterable, Identifiable {
    case percentage_of_carrier_pay
    case dispatch_fee_percent
    case per_mile
    case per_car

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .percentage_of_carrier_pay: return "% of Carrier Pay"
        case .dispatch_fee_percent: return "Dispatch Fee %"
        case .per_mile: return "Per Mile"
        case .per_car: return "Per Car"
        }
    }
}

// MARK: - Inspection Type

/// Matches VroomX database `inspection_type` enum.
enum InspectionType: String, Codable, CaseIterable, Identifiable {
    case pickup
    case delivery

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .pickup: return "Pickup"
        case .delivery: return "Delivery"
        }
    }
}

// MARK: - Inspection Status

/// Matches VroomX database `inspection_status` enum.
enum InspectionStatus: String, Codable, CaseIterable, Identifiable {
    case in_progress
    case completed

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .in_progress: return "In Progress"
        case .completed: return "Completed"
        }
    }
}

// MARK: - Damage Type

/// Matches VroomX database `damage_type` enum.
enum DamageType: String, Codable, CaseIterable, Identifiable {
    case scratch
    case dent
    case chip
    case broken
    case missing

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .scratch: return "Scratch"
        case .dent: return "Dent"
        case .chip: return "Chip"
        case .broken: return "Broken"
        case .missing: return "Missing"
        }
    }

    /// Single-character initial for compact markers on vehicle diagram.
    var initial: String {
        switch self {
        case .scratch: return "S"
        case .dent: return "D"
        case .chip: return "C"
        case .broken: return "B"
        case .missing: return "M"
        }
    }

    var color: Color {
        switch self {
        case .scratch: return .brandWarning
        case .dent: return .brandDanger
        case .chip: return .brandPrimary
        case .broken: return .brandDanger
        case .missing: return .brandAccent
        }
    }
}

// MARK: - Photo Type

/// Matches VroomX database `photo_type` enum.
enum PhotoType: String, Codable, CaseIterable, Identifiable {
    case odometer
    case front
    case left
    case right
    case rear
    case top
    case key_vin
    case custom_1
    case custom_2
    case custom_3
    case custom_4
    case custom_5

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .odometer: return "Odometer"
        case .front: return "Front"
        case .left: return "Left"
        case .right: return "Right"
        case .rear: return "Rear"
        case .top: return "Top"
        case .key_vin: return "Key/VIN"
        case .custom_1: return "Custom 1"
        case .custom_2: return "Custom 2"
        case .custom_3: return "Custom 3"
        case .custom_4: return "Custom 4"
        case .custom_5: return "Custom 5"
        }
    }
}

// MARK: - Notification Type

/// Matches VroomX database `notification_type` enum.
enum NotificationType: String, Codable, CaseIterable, Identifiable {
    case trip_assignment
    case status_change
    case dispatch_message
    case urgent

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .trip_assignment: return "Trip Assignment"
        case .status_change: return "Status Change"
        case .dispatch_message: return "Dispatch Message"
        case .urgent: return "Urgent"
        }
    }

    var icon: String {
        switch self {
        case .trip_assignment: return "truck.box.fill"
        case .status_change: return "arrow.triangle.2.circlepath"
        case .dispatch_message: return "message.fill"
        case .urgent: return "exclamationmark.triangle.fill"
        }
    }
}

// MARK: - Order Module

/// Client-side enum for Home tab order filtering.
/// Not stored in the database.
enum OrderModule: String, CaseIterable, Identifiable {
    case pickup
    case delivery
    case completed
    case archived

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .pickup: return "Pickup"
        case .delivery: return "Delivery"
        case .completed: return "Completed"
        case .archived: return "Archived"
        }
    }

    /// Returns the order statuses that belong to this module.
    var statuses: [OrderStatus] {
        switch self {
        case .pickup: return [.new, .assigned]
        case .delivery: return [.picked_up]
        case .completed: return [.delivered]
        case .archived: return [.invoiced, .paid, .cancelled]
        }
    }
}
