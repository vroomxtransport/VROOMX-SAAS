import SwiftUI

// MARK: - Vehicle Diagrams

/// Provides vehicle outline shapes for 5 vehicle types and 5 views each.
/// Used as the background layer in VehicleDiagramView for damage marker placement.
/// Vehicle types: sedan, SUV, truck (pickup), van, minivan.
/// Views: front, rear, left, right, top.
enum VehicleDiagrams {

    /// Available diagram views.
    enum DiagramView: String, CaseIterable, Identifiable {
        case front = "Front"
        case rear = "Rear"
        case left = "Left"
        case right = "Right"
        case top = "Top"

        var id: String { rawValue }

        var icon: String {
            switch self {
            case .front: return "arrow.up"
            case .rear: return "arrow.down"
            case .left: return "arrow.left"
            case .right: return "arrow.right"
            case .top: return "arrow.up.left.and.arrow.down.right"
            }
        }
    }

    /// Maps a vehicle type string from VroomXOrder to a supported diagram type.
    static func diagramType(for vehicleType: String) -> String {
        let normalized = vehicleType.lowercased()
        if normalized.contains("suv") || normalized.contains("crossover") {
            return "suv"
        } else if normalized.contains("truck") || normalized.contains("pickup") {
            return "truck"
        } else if normalized.contains("van") && !normalized.contains("mini") {
            return "van"
        } else if normalized.contains("minivan") || normalized.contains("mini") {
            return "minivan"
        }
        return "sedan" // default
    }

    /// Returns a vehicle outline Shape for the given type and view.
    /// The shape is drawn within a unit coordinate space (0-1) and should be
    /// scaled to fit the diagram container via .aspectRatio.
    static func outline(for vehicleType: String, view: DiagramView) -> AnyShape {
        let type = diagramType(for: vehicleType)

        switch (type, view) {
        // MARK: Sedan
        case ("sedan", .front):  return AnyShape(SedanFrontShape())
        case ("sedan", .rear):   return AnyShape(SedanRearShape())
        case ("sedan", .left):   return AnyShape(SedanSideShape())
        case ("sedan", .right):  return AnyShape(SedanSideShape().scale(x: -1, y: 1))
        case ("sedan", .top):    return AnyShape(SedanTopShape())

        // MARK: SUV
        case ("suv", .front):    return AnyShape(SUVFrontShape())
        case ("suv", .rear):     return AnyShape(SUVRearShape())
        case ("suv", .left):     return AnyShape(SUVSideShape())
        case ("suv", .right):    return AnyShape(SUVSideShape().scale(x: -1, y: 1))
        case ("suv", .top):      return AnyShape(SUVTopShape())

        // MARK: Truck
        case ("truck", .front):  return AnyShape(TruckFrontShape())
        case ("truck", .rear):   return AnyShape(TruckRearShape())
        case ("truck", .left):   return AnyShape(TruckSideShape())
        case ("truck", .right):  return AnyShape(TruckSideShape().scale(x: -1, y: 1))
        case ("truck", .top):    return AnyShape(TruckTopShape())

        // MARK: Van
        case ("van", .front):    return AnyShape(VanFrontShape())
        case ("van", .rear):     return AnyShape(VanRearShape())
        case ("van", .left):     return AnyShape(VanSideShape())
        case ("van", .right):    return AnyShape(VanSideShape().scale(x: -1, y: 1))
        case ("van", .top):      return AnyShape(VanTopShape())

        // MARK: Minivan
        case ("minivan", .front): return AnyShape(MinivanFrontShape())
        case ("minivan", .rear):  return AnyShape(MinivanRearShape())
        case ("minivan", .left):  return AnyShape(MinivanSideShape())
        case ("minivan", .right): return AnyShape(MinivanSideShape().scale(x: -1, y: 1))
        case ("minivan", .top):   return AnyShape(MinivanTopShape())

        // Fallback
        default: return AnyShape(SedanFrontShape())
        }
    }
}

// MARK: - Sedan Shapes

/// Sedan front view: windshield, hood, headlights, grille.
struct SedanFrontShape: Shape {
    func path(in rect: CGRect) -> Path {
        let w = rect.width
        let h = rect.height
        var p = Path()

        // Body outline
        p.move(to: CGPoint(x: w * 0.15, y: h * 0.95))
        p.addLine(to: CGPoint(x: w * 0.15, y: h * 0.55))
        p.addQuadCurve(to: CGPoint(x: w * 0.25, y: h * 0.25), control: CGPoint(x: w * 0.15, y: h * 0.35))
        p.addLine(to: CGPoint(x: w * 0.35, y: h * 0.15))
        p.addQuadCurve(to: CGPoint(x: w * 0.65, y: h * 0.15), control: CGPoint(x: w * 0.5, y: h * 0.08))
        p.addLine(to: CGPoint(x: w * 0.75, y: h * 0.25))
        p.addQuadCurve(to: CGPoint(x: w * 0.85, y: h * 0.55), control: CGPoint(x: w * 0.85, y: h * 0.35))
        p.addLine(to: CGPoint(x: w * 0.85, y: h * 0.95))
        p.closeSubpath()

        // Windshield
        p.move(to: CGPoint(x: w * 0.28, y: h * 0.28))
        p.addLine(to: CGPoint(x: w * 0.35, y: h * 0.18))
        p.addQuadCurve(to: CGPoint(x: w * 0.65, y: h * 0.18), control: CGPoint(x: w * 0.5, y: h * 0.12))
        p.addLine(to: CGPoint(x: w * 0.72, y: h * 0.28))
        p.closeSubpath()

        // Left headlight
        p.addRoundedRect(in: CGRect(x: w * 0.18, y: h * 0.58, width: w * 0.12, height: h * 0.08), cornerSize: CGSize(width: 4, height: 4))

        // Right headlight
        p.addRoundedRect(in: CGRect(x: w * 0.7, y: h * 0.58, width: w * 0.12, height: h * 0.08), cornerSize: CGSize(width: 4, height: 4))

        // Grille
        p.addRoundedRect(in: CGRect(x: w * 0.35, y: h * 0.62, width: w * 0.3, height: h * 0.1), cornerSize: CGSize(width: 6, height: 6))

        // Wheels (partial circles at bottom)
        p.addEllipse(in: CGRect(x: w * 0.12, y: h * 0.85, width: w * 0.15, height: h * 0.12))
        p.addEllipse(in: CGRect(x: w * 0.73, y: h * 0.85, width: w * 0.15, height: h * 0.12))

        return p
    }
}

/// Sedan rear view.
struct SedanRearShape: Shape {
    func path(in rect: CGRect) -> Path {
        let w = rect.width
        let h = rect.height
        var p = Path()

        // Body outline
        p.move(to: CGPoint(x: w * 0.15, y: h * 0.95))
        p.addLine(to: CGPoint(x: w * 0.15, y: h * 0.50))
        p.addQuadCurve(to: CGPoint(x: w * 0.25, y: h * 0.20), control: CGPoint(x: w * 0.15, y: h * 0.30))
        p.addLine(to: CGPoint(x: w * 0.35, y: h * 0.12))
        p.addQuadCurve(to: CGPoint(x: w * 0.65, y: h * 0.12), control: CGPoint(x: w * 0.5, y: h * 0.06))
        p.addLine(to: CGPoint(x: w * 0.75, y: h * 0.20))
        p.addQuadCurve(to: CGPoint(x: w * 0.85, y: h * 0.50), control: CGPoint(x: w * 0.85, y: h * 0.30))
        p.addLine(to: CGPoint(x: w * 0.85, y: h * 0.95))
        p.closeSubpath()

        // Rear windshield
        p.move(to: CGPoint(x: w * 0.30, y: h * 0.25))
        p.addLine(to: CGPoint(x: w * 0.36, y: h * 0.15))
        p.addQuadCurve(to: CGPoint(x: w * 0.64, y: h * 0.15), control: CGPoint(x: w * 0.5, y: h * 0.10))
        p.addLine(to: CGPoint(x: w * 0.70, y: h * 0.25))
        p.closeSubpath()

        // Tail lights
        p.addRoundedRect(in: CGRect(x: w * 0.17, y: h * 0.55, width: w * 0.10, height: h * 0.12), cornerSize: CGSize(width: 3, height: 3))
        p.addRoundedRect(in: CGRect(x: w * 0.73, y: h * 0.55, width: w * 0.10, height: h * 0.12), cornerSize: CGSize(width: 3, height: 3))

        // Trunk line
        p.move(to: CGPoint(x: w * 0.30, y: h * 0.45))
        p.addLine(to: CGPoint(x: w * 0.70, y: h * 0.45))

        // Bumper
        p.addRoundedRect(in: CGRect(x: w * 0.25, y: h * 0.78, width: w * 0.50, height: h * 0.06), cornerSize: CGSize(width: 4, height: 4))

        // Wheels
        p.addEllipse(in: CGRect(x: w * 0.12, y: h * 0.85, width: w * 0.15, height: h * 0.12))
        p.addEllipse(in: CGRect(x: w * 0.73, y: h * 0.85, width: w * 0.15, height: h * 0.12))

        return p
    }
}

/// Sedan side (left) view.
struct SedanSideShape: Shape {
    func path(in rect: CGRect) -> Path {
        let w = rect.width
        let h = rect.height
        var p = Path()

        // Body outline
        p.move(to: CGPoint(x: w * 0.05, y: h * 0.70))
        // Front bumper
        p.addLine(to: CGPoint(x: w * 0.05, y: h * 0.55))
        p.addQuadCurve(to: CGPoint(x: w * 0.12, y: h * 0.45), control: CGPoint(x: w * 0.05, y: h * 0.45))
        // Hood
        p.addLine(to: CGPoint(x: w * 0.30, y: h * 0.42))
        // Windshield
        p.addLine(to: CGPoint(x: w * 0.38, y: h * 0.15))
        // Roof
        p.addLine(to: CGPoint(x: w * 0.65, y: h * 0.12))
        // Rear windshield
        p.addLine(to: CGPoint(x: w * 0.75, y: h * 0.35))
        // Trunk
        p.addLine(to: CGPoint(x: w * 0.90, y: h * 0.38))
        // Rear
        p.addQuadCurve(to: CGPoint(x: w * 0.95, y: h * 0.55), control: CGPoint(x: w * 0.95, y: h * 0.38))
        p.addLine(to: CGPoint(x: w * 0.95, y: h * 0.70))
        p.closeSubpath()

        // Windows
        // Front window
        p.move(to: CGPoint(x: w * 0.32, y: h * 0.42))
        p.addLine(to: CGPoint(x: w * 0.40, y: h * 0.18))
        p.addLine(to: CGPoint(x: w * 0.50, y: h * 0.16))
        p.addLine(to: CGPoint(x: w * 0.50, y: h * 0.42))
        p.closeSubpath()

        // Rear window
        p.move(to: CGPoint(x: w * 0.52, y: h * 0.42))
        p.addLine(to: CGPoint(x: w * 0.52, y: h * 0.16))
        p.addLine(to: CGPoint(x: w * 0.63, y: h * 0.15))
        p.addLine(to: CGPoint(x: w * 0.73, y: h * 0.37))
        p.closeSubpath()

        // Door line
        p.move(to: CGPoint(x: w * 0.50, y: h * 0.15))
        p.addLine(to: CGPoint(x: w * 0.50, y: h * 0.70))

        // Door handle
        p.addRoundedRect(in: CGRect(x: w * 0.42, y: h * 0.48, width: w * 0.06, height: h * 0.03), cornerSize: CGSize(width: 2, height: 2))
        p.addRoundedRect(in: CGRect(x: w * 0.56, y: h * 0.48, width: w * 0.06, height: h * 0.03), cornerSize: CGSize(width: 2, height: 2))

        // Front wheel
        p.addEllipse(in: CGRect(x: w * 0.12, y: h * 0.62, width: w * 0.16, height: h * 0.18))
        // Rear wheel
        p.addEllipse(in: CGRect(x: w * 0.72, y: h * 0.62, width: w * 0.16, height: h * 0.18))

        return p
    }
}

/// Sedan top (bird's eye) view.
struct SedanTopShape: Shape {
    func path(in rect: CGRect) -> Path {
        let w = rect.width
        let h = rect.height
        var p = Path()

        // Body outline (elongated rounded rectangle)
        p.move(to: CGPoint(x: w * 0.30, y: h * 0.05))
        p.addQuadCurve(to: CGPoint(x: w * 0.70, y: h * 0.05), control: CGPoint(x: w * 0.50, y: h * 0.02))
        p.addLine(to: CGPoint(x: w * 0.75, y: h * 0.15))
        p.addLine(to: CGPoint(x: w * 0.78, y: h * 0.30))
        // Side
        p.addLine(to: CGPoint(x: w * 0.80, y: h * 0.70))
        p.addLine(to: CGPoint(x: w * 0.75, y: h * 0.88))
        p.addQuadCurve(to: CGPoint(x: w * 0.25, y: h * 0.88), control: CGPoint(x: w * 0.50, y: h * 0.95))
        p.addLine(to: CGPoint(x: w * 0.20, y: h * 0.70))
        p.addLine(to: CGPoint(x: w * 0.22, y: h * 0.30))
        p.addLine(to: CGPoint(x: w * 0.25, y: h * 0.15))
        p.closeSubpath()

        // Windshield
        p.addRoundedRect(in: CGRect(x: w * 0.28, y: h * 0.22, width: w * 0.44, height: h * 0.12), cornerSize: CGSize(width: 6, height: 6))

        // Rear windshield
        p.addRoundedRect(in: CGRect(x: w * 0.30, y: h * 0.65, width: w * 0.40, height: h * 0.10), cornerSize: CGSize(width: 6, height: 6))

        // Roof outline
        p.addRoundedRect(in: CGRect(x: w * 0.30, y: h * 0.36, width: w * 0.40, height: h * 0.27), cornerSize: CGSize(width: 4, height: 4))

        // Side mirrors
        p.addEllipse(in: CGRect(x: w * 0.15, y: h * 0.25, width: w * 0.06, height: h * 0.04))
        p.addEllipse(in: CGRect(x: w * 0.79, y: h * 0.25, width: w * 0.06, height: h * 0.04))

        return p
    }
}

// MARK: - SUV Shapes

/// SUV front view: taller, wider stance.
struct SUVFrontShape: Shape {
    func path(in rect: CGRect) -> Path {
        let w = rect.width
        let h = rect.height
        var p = Path()

        // Body outline - taller than sedan
        p.move(to: CGPoint(x: w * 0.12, y: h * 0.95))
        p.addLine(to: CGPoint(x: w * 0.12, y: h * 0.45))
        p.addQuadCurve(to: CGPoint(x: w * 0.20, y: h * 0.20), control: CGPoint(x: w * 0.12, y: h * 0.28))
        p.addLine(to: CGPoint(x: w * 0.30, y: h * 0.12))
        p.addQuadCurve(to: CGPoint(x: w * 0.70, y: h * 0.12), control: CGPoint(x: w * 0.50, y: h * 0.06))
        p.addLine(to: CGPoint(x: w * 0.80, y: h * 0.20))
        p.addQuadCurve(to: CGPoint(x: w * 0.88, y: h * 0.45), control: CGPoint(x: w * 0.88, y: h * 0.28))
        p.addLine(to: CGPoint(x: w * 0.88, y: h * 0.95))
        p.closeSubpath()

        // Windshield
        p.move(to: CGPoint(x: w * 0.24, y: h * 0.24))
        p.addLine(to: CGPoint(x: w * 0.32, y: h * 0.15))
        p.addQuadCurve(to: CGPoint(x: w * 0.68, y: h * 0.15), control: CGPoint(x: w * 0.50, y: h * 0.10))
        p.addLine(to: CGPoint(x: w * 0.76, y: h * 0.24))
        p.closeSubpath()

        // Headlights
        p.addRoundedRect(in: CGRect(x: w * 0.14, y: h * 0.50, width: w * 0.14, height: h * 0.08), cornerSize: CGSize(width: 4, height: 4))
        p.addRoundedRect(in: CGRect(x: w * 0.72, y: h * 0.50, width: w * 0.14, height: h * 0.08), cornerSize: CGSize(width: 4, height: 4))

        // Grille
        p.addRoundedRect(in: CGRect(x: w * 0.32, y: h * 0.55, width: w * 0.36, height: h * 0.12), cornerSize: CGSize(width: 6, height: 6))

        // Wheels
        p.addEllipse(in: CGRect(x: w * 0.08, y: h * 0.82, width: w * 0.18, height: h * 0.14))
        p.addEllipse(in: CGRect(x: w * 0.74, y: h * 0.82, width: w * 0.18, height: h * 0.14))

        return p
    }
}

struct SUVRearShape: Shape {
    func path(in rect: CGRect) -> Path {
        let w = rect.width
        let h = rect.height
        var p = Path()

        p.move(to: CGPoint(x: w * 0.12, y: h * 0.95))
        p.addLine(to: CGPoint(x: w * 0.12, y: h * 0.40))
        p.addLine(to: CGPoint(x: w * 0.15, y: h * 0.15))
        p.addQuadCurve(to: CGPoint(x: w * 0.85, y: h * 0.15), control: CGPoint(x: w * 0.50, y: h * 0.06))
        p.addLine(to: CGPoint(x: w * 0.88, y: h * 0.40))
        p.addLine(to: CGPoint(x: w * 0.88, y: h * 0.95))
        p.closeSubpath()

        // Rear windshield
        p.addRoundedRect(in: CGRect(x: w * 0.22, y: h * 0.18, width: w * 0.56, height: h * 0.18), cornerSize: CGSize(width: 6, height: 6))

        // Tail lights
        p.addRoundedRect(in: CGRect(x: w * 0.14, y: h * 0.45, width: w * 0.12, height: h * 0.15), cornerSize: CGSize(width: 3, height: 3))
        p.addRoundedRect(in: CGRect(x: w * 0.74, y: h * 0.45, width: w * 0.12, height: h * 0.15), cornerSize: CGSize(width: 3, height: 3))

        // Bumper
        p.addRoundedRect(in: CGRect(x: w * 0.20, y: h * 0.76, width: w * 0.60, height: h * 0.06), cornerSize: CGSize(width: 4, height: 4))

        // Wheels
        p.addEllipse(in: CGRect(x: w * 0.08, y: h * 0.82, width: w * 0.18, height: h * 0.14))
        p.addEllipse(in: CGRect(x: w * 0.74, y: h * 0.82, width: w * 0.18, height: h * 0.14))

        return p
    }
}

struct SUVSideShape: Shape {
    func path(in rect: CGRect) -> Path {
        let w = rect.width
        let h = rect.height
        var p = Path()

        // Body - taller, boxier than sedan
        p.move(to: CGPoint(x: w * 0.05, y: h * 0.72))
        p.addLine(to: CGPoint(x: w * 0.05, y: h * 0.48))
        p.addQuadCurve(to: CGPoint(x: w * 0.12, y: h * 0.38), control: CGPoint(x: w * 0.05, y: h * 0.38))
        p.addLine(to: CGPoint(x: w * 0.28, y: h * 0.35))
        p.addLine(to: CGPoint(x: w * 0.35, y: h * 0.12))
        p.addLine(to: CGPoint(x: w * 0.70, y: h * 0.10))
        p.addLine(to: CGPoint(x: w * 0.72, y: h * 0.32))
        p.addLine(to: CGPoint(x: w * 0.92, y: h * 0.32))
        p.addQuadCurve(to: CGPoint(x: w * 0.95, y: h * 0.48), control: CGPoint(x: w * 0.95, y: h * 0.32))
        p.addLine(to: CGPoint(x: w * 0.95, y: h * 0.72))
        p.closeSubpath()

        // Windows
        p.move(to: CGPoint(x: w * 0.30, y: h * 0.36))
        p.addLine(to: CGPoint(x: w * 0.37, y: h * 0.15))
        p.addLine(to: CGPoint(x: w * 0.48, y: h * 0.14))
        p.addLine(to: CGPoint(x: w * 0.48, y: h * 0.36))
        p.closeSubpath()

        p.move(to: CGPoint(x: w * 0.50, y: h * 0.36))
        p.addLine(to: CGPoint(x: w * 0.50, y: h * 0.14))
        p.addLine(to: CGPoint(x: w * 0.68, y: h * 0.13))
        p.addLine(to: CGPoint(x: w * 0.70, y: h * 0.34))
        p.closeSubpath()

        // Wheels
        p.addEllipse(in: CGRect(x: w * 0.10, y: h * 0.62, width: w * 0.18, height: h * 0.20))
        p.addEllipse(in: CGRect(x: w * 0.72, y: h * 0.62, width: w * 0.18, height: h * 0.20))

        return p
    }
}

struct SUVTopShape: Shape {
    func path(in rect: CGRect) -> Path {
        let w = rect.width
        let h = rect.height
        var p = Path()

        // Wider, boxier top view
        p.move(to: CGPoint(x: w * 0.28, y: h * 0.05))
        p.addQuadCurve(to: CGPoint(x: w * 0.72, y: h * 0.05), control: CGPoint(x: w * 0.50, y: h * 0.02))
        p.addLine(to: CGPoint(x: w * 0.78, y: h * 0.15))
        p.addLine(to: CGPoint(x: w * 0.82, y: h * 0.30))
        p.addLine(to: CGPoint(x: w * 0.82, y: h * 0.75))
        p.addLine(to: CGPoint(x: w * 0.78, y: h * 0.90))
        p.addQuadCurve(to: CGPoint(x: w * 0.22, y: h * 0.90), control: CGPoint(x: w * 0.50, y: h * 0.95))
        p.addLine(to: CGPoint(x: w * 0.18, y: h * 0.75))
        p.addLine(to: CGPoint(x: w * 0.18, y: h * 0.30))
        p.addLine(to: CGPoint(x: w * 0.22, y: h * 0.15))
        p.closeSubpath()

        // Windshield
        p.addRoundedRect(in: CGRect(x: w * 0.25, y: h * 0.18, width: w * 0.50, height: h * 0.12), cornerSize: CGSize(width: 6, height: 6))

        // Rear windshield
        p.addRoundedRect(in: CGRect(x: w * 0.27, y: h * 0.70, width: w * 0.46, height: h * 0.10), cornerSize: CGSize(width: 6, height: 6))

        // Roof
        p.addRoundedRect(in: CGRect(x: w * 0.27, y: h * 0.32, width: w * 0.46, height: h * 0.36), cornerSize: CGSize(width: 4, height: 4))

        // Side mirrors
        p.addEllipse(in: CGRect(x: w * 0.12, y: h * 0.22, width: w * 0.06, height: h * 0.04))
        p.addEllipse(in: CGRect(x: w * 0.82, y: h * 0.22, width: w * 0.06, height: h * 0.04))

        return p
    }
}

// MARK: - Truck (Pickup) Shapes

struct TruckFrontShape: Shape {
    func path(in rect: CGRect) -> Path {
        let w = rect.width
        let h = rect.height
        var p = Path()

        // Tall, wide front
        p.move(to: CGPoint(x: w * 0.10, y: h * 0.95))
        p.addLine(to: CGPoint(x: w * 0.10, y: h * 0.42))
        p.addQuadCurve(to: CGPoint(x: w * 0.18, y: h * 0.18), control: CGPoint(x: w * 0.10, y: h * 0.25))
        p.addLine(to: CGPoint(x: w * 0.30, y: h * 0.10))
        p.addQuadCurve(to: CGPoint(x: w * 0.70, y: h * 0.10), control: CGPoint(x: w * 0.50, y: h * 0.04))
        p.addLine(to: CGPoint(x: w * 0.82, y: h * 0.18))
        p.addQuadCurve(to: CGPoint(x: w * 0.90, y: h * 0.42), control: CGPoint(x: w * 0.90, y: h * 0.25))
        p.addLine(to: CGPoint(x: w * 0.90, y: h * 0.95))
        p.closeSubpath()

        // Windshield
        p.move(to: CGPoint(x: w * 0.22, y: h * 0.22))
        p.addLine(to: CGPoint(x: w * 0.32, y: h * 0.13))
        p.addQuadCurve(to: CGPoint(x: w * 0.68, y: h * 0.13), control: CGPoint(x: w * 0.50, y: h * 0.08))
        p.addLine(to: CGPoint(x: w * 0.78, y: h * 0.22))
        p.closeSubpath()

        // Headlights
        p.addRoundedRect(in: CGRect(x: w * 0.12, y: h * 0.48, width: w * 0.15, height: h * 0.10), cornerSize: CGSize(width: 4, height: 4))
        p.addRoundedRect(in: CGRect(x: w * 0.73, y: h * 0.48, width: w * 0.15, height: h * 0.10), cornerSize: CGSize(width: 4, height: 4))

        // Grille
        p.addRoundedRect(in: CGRect(x: w * 0.30, y: h * 0.52, width: w * 0.40, height: h * 0.14), cornerSize: CGSize(width: 6, height: 6))

        // Wheels
        p.addEllipse(in: CGRect(x: w * 0.06, y: h * 0.80, width: w * 0.20, height: h * 0.16))
        p.addEllipse(in: CGRect(x: w * 0.74, y: h * 0.80, width: w * 0.20, height: h * 0.16))

        return p
    }
}

struct TruckRearShape: Shape {
    func path(in rect: CGRect) -> Path {
        let w = rect.width
        let h = rect.height
        var p = Path()

        // Tailgate view
        p.move(to: CGPoint(x: w * 0.10, y: h * 0.95))
        p.addLine(to: CGPoint(x: w * 0.10, y: h * 0.25))
        p.addLine(to: CGPoint(x: w * 0.90, y: h * 0.25))
        p.addLine(to: CGPoint(x: w * 0.90, y: h * 0.95))
        p.closeSubpath()

        // Tailgate panel
        p.addRoundedRect(in: CGRect(x: w * 0.15, y: h * 0.30, width: w * 0.70, height: h * 0.35), cornerSize: CGSize(width: 4, height: 4))

        // Tail lights
        p.addRoundedRect(in: CGRect(x: w * 0.12, y: h * 0.30, width: w * 0.08, height: h * 0.18), cornerSize: CGSize(width: 3, height: 3))
        p.addRoundedRect(in: CGRect(x: w * 0.80, y: h * 0.30, width: w * 0.08, height: h * 0.18), cornerSize: CGSize(width: 3, height: 3))

        // Bumper
        p.addRoundedRect(in: CGRect(x: w * 0.12, y: h * 0.72, width: w * 0.76, height: h * 0.06), cornerSize: CGSize(width: 4, height: 4))

        // Wheels
        p.addEllipse(in: CGRect(x: w * 0.06, y: h * 0.80, width: w * 0.20, height: h * 0.16))
        p.addEllipse(in: CGRect(x: w * 0.74, y: h * 0.80, width: w * 0.20, height: h * 0.16))

        return p
    }
}

struct TruckSideShape: Shape {
    func path(in rect: CGRect) -> Path {
        let w = rect.width
        let h = rect.height
        var p = Path()

        // Cab + bed profile
        p.move(to: CGPoint(x: w * 0.03, y: h * 0.72))
        p.addLine(to: CGPoint(x: w * 0.03, y: h * 0.45))
        p.addQuadCurve(to: CGPoint(x: w * 0.10, y: h * 0.35), control: CGPoint(x: w * 0.03, y: h * 0.35))
        p.addLine(to: CGPoint(x: w * 0.22, y: h * 0.32))
        // Windshield
        p.addLine(to: CGPoint(x: w * 0.30, y: h * 0.10))
        // Roof
        p.addLine(to: CGPoint(x: w * 0.50, y: h * 0.08))
        // Rear of cab
        p.addLine(to: CGPoint(x: w * 0.52, y: h * 0.30))
        // Bed
        p.addLine(to: CGPoint(x: w * 0.55, y: h * 0.30))
        p.addLine(to: CGPoint(x: w * 0.55, y: h * 0.28))
        p.addLine(to: CGPoint(x: w * 0.95, y: h * 0.28))
        p.addLine(to: CGPoint(x: w * 0.95, y: h * 0.72))
        p.closeSubpath()

        // Cab window
        p.move(to: CGPoint(x: w * 0.24, y: h * 0.34))
        p.addLine(to: CGPoint(x: w * 0.32, y: h * 0.13))
        p.addLine(to: CGPoint(x: w * 0.48, y: h * 0.12))
        p.addLine(to: CGPoint(x: w * 0.50, y: h * 0.30))
        p.addLine(to: CGPoint(x: w * 0.50, y: h * 0.34))
        p.closeSubpath()

        // Bed floor line
        p.move(to: CGPoint(x: w * 0.55, y: h * 0.50))
        p.addLine(to: CGPoint(x: w * 0.95, y: h * 0.50))

        // Wheels
        p.addEllipse(in: CGRect(x: w * 0.10, y: h * 0.62, width: w * 0.18, height: h * 0.20))
        p.addEllipse(in: CGRect(x: w * 0.74, y: h * 0.62, width: w * 0.18, height: h * 0.20))

        return p
    }
}

struct TruckTopShape: Shape {
    func path(in rect: CGRect) -> Path {
        let w = rect.width
        let h = rect.height
        var p = Path()

        // Cab top view
        p.move(to: CGPoint(x: w * 0.28, y: h * 0.05))
        p.addQuadCurve(to: CGPoint(x: w * 0.72, y: h * 0.05), control: CGPoint(x: w * 0.50, y: h * 0.02))
        p.addLine(to: CGPoint(x: w * 0.76, y: h * 0.12))
        p.addLine(to: CGPoint(x: w * 0.78, y: h * 0.35))
        // Bed (wider)
        p.addLine(to: CGPoint(x: w * 0.82, y: h * 0.38))
        p.addLine(to: CGPoint(x: w * 0.82, y: h * 0.92))
        p.addQuadCurve(to: CGPoint(x: w * 0.18, y: h * 0.92), control: CGPoint(x: w * 0.50, y: h * 0.95))
        p.addLine(to: CGPoint(x: w * 0.18, y: h * 0.38))
        p.addLine(to: CGPoint(x: w * 0.22, y: h * 0.35))
        p.addLine(to: CGPoint(x: w * 0.24, y: h * 0.12))
        p.closeSubpath()

        // Cab windshield
        p.addRoundedRect(in: CGRect(x: w * 0.26, y: h * 0.08, width: w * 0.48, height: h * 0.10), cornerSize: CGSize(width: 6, height: 6))

        // Cab roof
        p.addRoundedRect(in: CGRect(x: w * 0.26, y: h * 0.20, width: w * 0.48, height: h * 0.14), cornerSize: CGSize(width: 4, height: 4))

        // Bed outline
        p.addRoundedRect(in: CGRect(x: w * 0.20, y: h * 0.40, width: w * 0.60, height: h * 0.48), cornerSize: CGSize(width: 4, height: 4))

        // Bed center divider
        p.move(to: CGPoint(x: w * 0.50, y: h * 0.40))
        p.addLine(to: CGPoint(x: w * 0.50, y: h * 0.88))

        // Side mirrors
        p.addEllipse(in: CGRect(x: w * 0.14, y: h * 0.14, width: w * 0.06, height: h * 0.04))
        p.addEllipse(in: CGRect(x: w * 0.80, y: h * 0.14, width: w * 0.06, height: h * 0.04))

        return p
    }
}

// MARK: - Van Shapes

struct VanFrontShape: Shape {
    func path(in rect: CGRect) -> Path {
        let w = rect.width
        let h = rect.height
        var p = Path()

        // Tall, flat front
        p.move(to: CGPoint(x: w * 0.12, y: h * 0.95))
        p.addLine(to: CGPoint(x: w * 0.12, y: h * 0.35))
        p.addLine(to: CGPoint(x: w * 0.15, y: h * 0.12))
        p.addQuadCurve(to: CGPoint(x: w * 0.85, y: h * 0.12), control: CGPoint(x: w * 0.50, y: h * 0.05))
        p.addLine(to: CGPoint(x: w * 0.88, y: h * 0.35))
        p.addLine(to: CGPoint(x: w * 0.88, y: h * 0.95))
        p.closeSubpath()

        // Large windshield
        p.addRoundedRect(in: CGRect(x: w * 0.20, y: h * 0.15, width: w * 0.60, height: h * 0.22), cornerSize: CGSize(width: 8, height: 8))

        // Headlights
        p.addRoundedRect(in: CGRect(x: w * 0.14, y: h * 0.45, width: w * 0.14, height: h * 0.08), cornerSize: CGSize(width: 4, height: 4))
        p.addRoundedRect(in: CGRect(x: w * 0.72, y: h * 0.45, width: w * 0.14, height: h * 0.08), cornerSize: CGSize(width: 4, height: 4))

        // Grille
        p.addRoundedRect(in: CGRect(x: w * 0.32, y: h * 0.50, width: w * 0.36, height: h * 0.10), cornerSize: CGSize(width: 6, height: 6))

        // Wheels
        p.addEllipse(in: CGRect(x: w * 0.08, y: h * 0.82, width: w * 0.18, height: h * 0.14))
        p.addEllipse(in: CGRect(x: w * 0.74, y: h * 0.82, width: w * 0.18, height: h * 0.14))

        return p
    }
}

struct VanRearShape: Shape {
    func path(in rect: CGRect) -> Path {
        let w = rect.width
        let h = rect.height
        var p = Path()

        // Flat, tall rear
        p.move(to: CGPoint(x: w * 0.12, y: h * 0.95))
        p.addLine(to: CGPoint(x: w * 0.12, y: h * 0.12))
        p.addQuadCurve(to: CGPoint(x: w * 0.88, y: h * 0.12), control: CGPoint(x: w * 0.50, y: h * 0.05))
        p.addLine(to: CGPoint(x: w * 0.88, y: h * 0.95))
        p.closeSubpath()

        // Rear doors (double)
        p.move(to: CGPoint(x: w * 0.50, y: h * 0.15))
        p.addLine(to: CGPoint(x: w * 0.50, y: h * 0.75))

        // Door windows
        p.addRoundedRect(in: CGRect(x: w * 0.18, y: h * 0.18, width: w * 0.28, height: h * 0.20), cornerSize: CGSize(width: 4, height: 4))
        p.addRoundedRect(in: CGRect(x: w * 0.54, y: h * 0.18, width: w * 0.28, height: h * 0.20), cornerSize: CGSize(width: 4, height: 4))

        // Tail lights
        p.addRoundedRect(in: CGRect(x: w * 0.14, y: h * 0.45, width: w * 0.08, height: h * 0.15), cornerSize: CGSize(width: 3, height: 3))
        p.addRoundedRect(in: CGRect(x: w * 0.78, y: h * 0.45, width: w * 0.08, height: h * 0.15), cornerSize: CGSize(width: 3, height: 3))

        // Bumper
        p.addRoundedRect(in: CGRect(x: w * 0.18, y: h * 0.78, width: w * 0.64, height: h * 0.06), cornerSize: CGSize(width: 4, height: 4))

        // Wheels
        p.addEllipse(in: CGRect(x: w * 0.08, y: h * 0.82, width: w * 0.18, height: h * 0.14))
        p.addEllipse(in: CGRect(x: w * 0.74, y: h * 0.82, width: w * 0.18, height: h * 0.14))

        return p
    }
}

struct VanSideShape: Shape {
    func path(in rect: CGRect) -> Path {
        let w = rect.width
        let h = rect.height
        var p = Path()

        // Tall, boxy side
        p.move(to: CGPoint(x: w * 0.03, y: h * 0.72))
        p.addLine(to: CGPoint(x: w * 0.03, y: h * 0.40))
        p.addQuadCurve(to: CGPoint(x: w * 0.10, y: h * 0.30), control: CGPoint(x: w * 0.03, y: h * 0.30))
        p.addLine(to: CGPoint(x: w * 0.20, y: h * 0.28))
        p.addLine(to: CGPoint(x: w * 0.25, y: h * 0.08))
        p.addLine(to: CGPoint(x: w * 0.95, y: h * 0.08))
        p.addLine(to: CGPoint(x: w * 0.97, y: h * 0.72))
        p.closeSubpath()

        // Front window
        p.move(to: CGPoint(x: w * 0.22, y: h * 0.30))
        p.addLine(to: CGPoint(x: w * 0.27, y: h * 0.12))
        p.addLine(to: CGPoint(x: w * 0.38, y: h * 0.12))
        p.addLine(to: CGPoint(x: w * 0.38, y: h * 0.30))
        p.closeSubpath()

        // Side windows (multiple)
        p.addRoundedRect(in: CGRect(x: w * 0.42, y: h * 0.12, width: w * 0.12, height: h * 0.18), cornerSize: CGSize(width: 3, height: 3))
        p.addRoundedRect(in: CGRect(x: w * 0.56, y: h * 0.12, width: w * 0.12, height: h * 0.18), cornerSize: CGSize(width: 3, height: 3))
        p.addRoundedRect(in: CGRect(x: w * 0.70, y: h * 0.12, width: w * 0.12, height: h * 0.18), cornerSize: CGSize(width: 3, height: 3))

        // Sliding door track
        p.move(to: CGPoint(x: w * 0.40, y: h * 0.32))
        p.addLine(to: CGPoint(x: w * 0.40, y: h * 0.72))

        // Wheels
        p.addEllipse(in: CGRect(x: w * 0.08, y: h * 0.62, width: w * 0.18, height: h * 0.20))
        p.addEllipse(in: CGRect(x: w * 0.76, y: h * 0.62, width: w * 0.18, height: h * 0.20))

        return p
    }
}

struct VanTopShape: Shape {
    func path(in rect: CGRect) -> Path {
        let w = rect.width
        let h = rect.height
        var p = Path()

        // Wide, long rectangle
        p.move(to: CGPoint(x: w * 0.25, y: h * 0.05))
        p.addQuadCurve(to: CGPoint(x: w * 0.75, y: h * 0.05), control: CGPoint(x: w * 0.50, y: h * 0.02))
        p.addLine(to: CGPoint(x: w * 0.82, y: h * 0.12))
        p.addLine(to: CGPoint(x: w * 0.84, y: h * 0.85))
        p.addQuadCurve(to: CGPoint(x: w * 0.16, y: h * 0.85), control: CGPoint(x: w * 0.50, y: h * 0.92))
        p.addLine(to: CGPoint(x: w * 0.18, y: h * 0.12))
        p.closeSubpath()

        // Windshield
        p.addRoundedRect(in: CGRect(x: w * 0.22, y: h * 0.08, width: w * 0.56, height: h * 0.12), cornerSize: CGSize(width: 6, height: 6))

        // Roof (large)
        p.addRoundedRect(in: CGRect(x: w * 0.22, y: h * 0.22, width: w * 0.56, height: h * 0.55), cornerSize: CGSize(width: 4, height: 4))

        // Side mirrors
        p.addEllipse(in: CGRect(x: w * 0.10, y: h * 0.12, width: w * 0.07, height: h * 0.04))
        p.addEllipse(in: CGRect(x: w * 0.83, y: h * 0.12, width: w * 0.07, height: h * 0.04))

        return p
    }
}

// MARK: - Minivan Shapes

struct MinivanFrontShape: Shape {
    func path(in rect: CGRect) -> Path {
        let w = rect.width
        let h = rect.height
        var p = Path()

        // Rounded front, between sedan and van height
        p.move(to: CGPoint(x: w * 0.13, y: h * 0.95))
        p.addLine(to: CGPoint(x: w * 0.13, y: h * 0.48))
        p.addQuadCurve(to: CGPoint(x: w * 0.20, y: h * 0.22), control: CGPoint(x: w * 0.13, y: h * 0.30))
        p.addLine(to: CGPoint(x: w * 0.30, y: h * 0.12))
        p.addQuadCurve(to: CGPoint(x: w * 0.70, y: h * 0.12), control: CGPoint(x: w * 0.50, y: h * 0.06))
        p.addLine(to: CGPoint(x: w * 0.80, y: h * 0.22))
        p.addQuadCurve(to: CGPoint(x: w * 0.87, y: h * 0.48), control: CGPoint(x: w * 0.87, y: h * 0.30))
        p.addLine(to: CGPoint(x: w * 0.87, y: h * 0.95))
        p.closeSubpath()

        // Windshield
        p.move(to: CGPoint(x: w * 0.24, y: h * 0.26))
        p.addLine(to: CGPoint(x: w * 0.32, y: h * 0.15))
        p.addQuadCurve(to: CGPoint(x: w * 0.68, y: h * 0.15), control: CGPoint(x: w * 0.50, y: h * 0.10))
        p.addLine(to: CGPoint(x: w * 0.76, y: h * 0.26))
        p.closeSubpath()

        // Headlights
        p.addRoundedRect(in: CGRect(x: w * 0.15, y: h * 0.52, width: w * 0.13, height: h * 0.08), cornerSize: CGSize(width: 4, height: 4))
        p.addRoundedRect(in: CGRect(x: w * 0.72, y: h * 0.52, width: w * 0.13, height: h * 0.08), cornerSize: CGSize(width: 4, height: 4))

        // Grille
        p.addRoundedRect(in: CGRect(x: w * 0.32, y: h * 0.56, width: w * 0.36, height: h * 0.10), cornerSize: CGSize(width: 6, height: 6))

        // Wheels
        p.addEllipse(in: CGRect(x: w * 0.09, y: h * 0.82, width: w * 0.17, height: h * 0.14))
        p.addEllipse(in: CGRect(x: w * 0.74, y: h * 0.82, width: w * 0.17, height: h * 0.14))

        return p
    }
}

struct MinivanRearShape: Shape {
    func path(in rect: CGRect) -> Path {
        let w = rect.width
        let h = rect.height
        var p = Path()

        p.move(to: CGPoint(x: w * 0.13, y: h * 0.95))
        p.addLine(to: CGPoint(x: w * 0.13, y: h * 0.15))
        p.addQuadCurve(to: CGPoint(x: w * 0.87, y: h * 0.15), control: CGPoint(x: w * 0.50, y: h * 0.06))
        p.addLine(to: CGPoint(x: w * 0.87, y: h * 0.95))
        p.closeSubpath()

        // Rear windshield
        p.addRoundedRect(in: CGRect(x: w * 0.22, y: h * 0.18, width: w * 0.56, height: h * 0.20), cornerSize: CGSize(width: 6, height: 6))

        // Tail lights
        p.addRoundedRect(in: CGRect(x: w * 0.15, y: h * 0.45, width: w * 0.10, height: h * 0.15), cornerSize: CGSize(width: 3, height: 3))
        p.addRoundedRect(in: CGRect(x: w * 0.75, y: h * 0.45, width: w * 0.10, height: h * 0.15), cornerSize: CGSize(width: 3, height: 3))

        // Bumper
        p.addRoundedRect(in: CGRect(x: w * 0.20, y: h * 0.76, width: w * 0.60, height: h * 0.06), cornerSize: CGSize(width: 4, height: 4))

        // Wheels
        p.addEllipse(in: CGRect(x: w * 0.09, y: h * 0.82, width: w * 0.17, height: h * 0.14))
        p.addEllipse(in: CGRect(x: w * 0.74, y: h * 0.82, width: w * 0.17, height: h * 0.14))

        return p
    }
}

struct MinivanSideShape: Shape {
    func path(in rect: CGRect) -> Path {
        let w = rect.width
        let h = rect.height
        var p = Path()

        // Rounded, sloping profile
        p.move(to: CGPoint(x: w * 0.03, y: h * 0.72))
        p.addLine(to: CGPoint(x: w * 0.03, y: h * 0.48))
        p.addQuadCurve(to: CGPoint(x: w * 0.10, y: h * 0.38), control: CGPoint(x: w * 0.03, y: h * 0.38))
        p.addLine(to: CGPoint(x: w * 0.22, y: h * 0.35))
        p.addLine(to: CGPoint(x: w * 0.28, y: h * 0.12))
        p.addLine(to: CGPoint(x: w * 0.72, y: h * 0.10))
        // Sloping rear
        p.addQuadCurve(to: CGPoint(x: w * 0.95, y: h * 0.35), control: CGPoint(x: w * 0.90, y: h * 0.10))
        p.addLine(to: CGPoint(x: w * 0.95, y: h * 0.72))
        p.closeSubpath()

        // Front window
        p.move(to: CGPoint(x: w * 0.24, y: h * 0.36))
        p.addLine(to: CGPoint(x: w * 0.30, y: h * 0.15))
        p.addLine(to: CGPoint(x: w * 0.40, y: h * 0.14))
        p.addLine(to: CGPoint(x: w * 0.40, y: h * 0.36))
        p.closeSubpath()

        // Side windows
        p.addRoundedRect(in: CGRect(x: w * 0.43, y: h * 0.14, width: w * 0.12, height: h * 0.20), cornerSize: CGSize(width: 3, height: 3))
        p.addRoundedRect(in: CGRect(x: w * 0.57, y: h * 0.14, width: w * 0.12, height: h * 0.20), cornerSize: CGSize(width: 3, height: 3))

        // Sliding door line
        p.move(to: CGPoint(x: w * 0.42, y: h * 0.12))
        p.addLine(to: CGPoint(x: w * 0.42, y: h * 0.72))

        // Door handle
        p.addRoundedRect(in: CGRect(x: w * 0.55, y: h * 0.42, width: w * 0.06, height: h * 0.03), cornerSize: CGSize(width: 2, height: 2))

        // Wheels
        p.addEllipse(in: CGRect(x: w * 0.10, y: h * 0.62, width: w * 0.16, height: h * 0.20))
        p.addEllipse(in: CGRect(x: w * 0.74, y: h * 0.62, width: w * 0.16, height: h * 0.20))

        return p
    }
}

struct MinivanTopShape: Shape {
    func path(in rect: CGRect) -> Path {
        let w = rect.width
        let h = rect.height
        var p = Path()

        // Rounded rectangle
        p.move(to: CGPoint(x: w * 0.28, y: h * 0.05))
        p.addQuadCurve(to: CGPoint(x: w * 0.72, y: h * 0.05), control: CGPoint(x: w * 0.50, y: h * 0.02))
        p.addLine(to: CGPoint(x: w * 0.78, y: h * 0.12))
        p.addLine(to: CGPoint(x: w * 0.80, y: h * 0.28))
        p.addLine(to: CGPoint(x: w * 0.80, y: h * 0.82))
        p.addQuadCurve(to: CGPoint(x: w * 0.20, y: h * 0.82), control: CGPoint(x: w * 0.50, y: h * 0.90))
        p.addLine(to: CGPoint(x: w * 0.20, y: h * 0.28))
        p.addLine(to: CGPoint(x: w * 0.22, y: h * 0.12))
        p.closeSubpath()

        // Windshield
        p.addRoundedRect(in: CGRect(x: w * 0.25, y: h * 0.08, width: w * 0.50, height: h * 0.12), cornerSize: CGSize(width: 6, height: 6))

        // Rear windshield
        p.addRoundedRect(in: CGRect(x: w * 0.27, y: h * 0.68, width: w * 0.46, height: h * 0.10), cornerSize: CGSize(width: 6, height: 6))

        // Roof
        p.addRoundedRect(in: CGRect(x: w * 0.27, y: h * 0.22, width: w * 0.46, height: h * 0.44), cornerSize: CGSize(width: 4, height: 4))

        // Side mirrors
        p.addEllipse(in: CGRect(x: w * 0.13, y: h * 0.14, width: w * 0.06, height: h * 0.04))
        p.addEllipse(in: CGRect(x: w * 0.81, y: h * 0.14, width: w * 0.06, height: h * 0.04))

        return p
    }
}
