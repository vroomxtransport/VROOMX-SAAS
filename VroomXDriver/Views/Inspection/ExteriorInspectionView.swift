import SwiftUI

// MARK: - Exterior Inspection View

/// Step 3 of the inspection flow: interactive exterior vehicle inspection.
/// Displays a 5-view selector (Front/Rear/Left/Right/Top), interactive vehicle
/// diagram with tap-to-place damage markers, and a damage type picker with
/// color-coded initials.
struct ExteriorInspectionView: View {
    let vehicleType: String
    @Binding var damages: [LocalDamage]

    @State private var currentView: VehicleDiagrams.DiagramView = .front
    @State private var selectedDamageType: DamageType = .scratch

    // MARK: - Computed

    /// Total damages across all views.
    private var totalDamageCount: Int {
        damages.count
    }

    /// Damages for the currently selected view.
    private var currentViewDamages: [LocalDamage] {
        damages.filter { $0.view == currentView.rawValue }
    }

    /// Count of damages per view for the badge display.
    private func damageCount(for view: VehicleDiagrams.DiagramView) -> Int {
        damages.filter { $0.view == view.rawValue }.count
    }

    // MARK: - Body

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Header
                VStack(alignment: .leading, spacing: 4) {
                    Text("Exterior Inspection")
                        .font(.vroomxTitleMedium)
                        .foregroundColor(.textPrimary)

                    Text("Tap on the vehicle diagram to mark damage locations")
                        .font(.vroomxBody)
                        .foregroundColor(.textSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16)

                // View selector (5 tabs)
                viewSelector
                    .padding(.horizontal, 16)

                // Vehicle diagram with damage markers
                VehicleDiagramView(
                    vehicleType: vehicleType,
                    currentView: currentView,
                    damages: $damages,
                    selectedDamageType: selectedDamageType
                )
                .padding(.horizontal, 16)
                .frame(minHeight: 280)

                // Damage type picker
                damageTypePicker
                    .padding(.horizontal, 16)

                // Damage summary
                if totalDamageCount > 0 {
                    damageSummary
                        .padding(.horizontal, 16)
                }

                // Damage list for current view
                if !currentViewDamages.isEmpty {
                    damageList
                        .padding(.horizontal, 16)
                }
            }
            .padding(.vertical, 16)
        }
    }

    // MARK: - View Selector

    private var viewSelector: some View {
        HStack(spacing: 4) {
            ForEach(VehicleDiagrams.DiagramView.allCases) { view in
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        currentView = view
                    }
                } label: {
                    VStack(spacing: 4) {
                        ZStack(alignment: .topTrailing) {
                            Image(systemName: view.icon)
                                .font(.system(size: 16))
                                .frame(width: 32, height: 24)

                            // Damage count badge
                            let count = damageCount(for: view)
                            if count > 0 {
                                Text("\(count)")
                                    .font(.system(size: 9, weight: .bold))
                                    .foregroundColor(.white)
                                    .frame(width: 16, height: 16)
                                    .background(Color.brandDanger)
                                    .clipShape(Circle())
                                    .offset(x: 6, y: -4)
                            }
                        }

                        Text(view.rawValue)
                            .font(.vroomxCaptionSmall)
                            .lineLimit(1)
                    }
                    .foregroundColor(currentView == view ? .brandPrimary : .textSecondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(
                        currentView == view
                            ? Color.brandPrimary.opacity(0.1)
                            : Color.clear
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .strokeBorder(
                                currentView == view ? Color.brandPrimary : Color.textSecondary.opacity(0.2),
                                lineWidth: currentView == view ? 1.5 : 1
                            )
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Damage Type Picker

    private var damageTypePicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("SELECT DAMAGE TYPE")
                .font(.vroomxCaptionSmall)
                .foregroundColor(.textSecondary)

            HStack(spacing: 8) {
                ForEach(DamageType.allCases) { type in
                    Button {
                        selectedDamageType = type
                    } label: {
                        HStack(spacing: 6) {
                            ZStack {
                                Circle()
                                    .fill(type.color)
                                    .frame(width: 24, height: 24)

                                Text(type.initial)
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundColor(.white)
                            }

                            Text(type.displayName)
                                .font(.vroomxCaptionSmall)
                                .foregroundColor(selectedDamageType == type ? type.color : .textSecondary)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 8)
                        .background(
                            selectedDamageType == type
                                ? type.color.opacity(0.1)
                                : Color.cardBackground
                        )
                        .clipShape(Capsule())
                        .overlay(
                            Capsule()
                                .strokeBorder(
                                    selectedDamageType == type ? type.color : Color.textSecondary.opacity(0.2),
                                    lineWidth: selectedDamageType == type ? 1.5 : 1
                                )
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: - Damage Summary

    private var damageSummary: some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(.brandWarning)

            Text("\(totalDamageCount) damage\(totalDamageCount == 1 ? "" : "s") marked")
                .font(.vroomxBodyBold)
                .foregroundColor(.textPrimary)

            Spacer()

            // Per-type breakdown
            HStack(spacing: 4) {
                ForEach(DamageType.allCases) { type in
                    let count = damages.filter { $0.damageType == type }.count
                    if count > 0 {
                        HStack(spacing: 2) {
                            Circle()
                                .fill(type.color)
                                .frame(width: 8, height: 8)
                            Text("\(count)")
                                .font(.vroomxCaptionSmall)
                                .foregroundColor(.textSecondary)
                        }
                    }
                }
            }
        }
        .padding(12)
        .background(Color.brandWarning.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    // MARK: - Damage List

    private var damageList: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("\(currentView.rawValue.uppercased()) DAMAGES")
                .font(.vroomxCaptionSmall)
                .foregroundColor(.textSecondary)

            ForEach(currentViewDamages) { damage in
                HStack(spacing: 10) {
                    // Type indicator
                    ZStack {
                        Circle()
                            .fill(damage.damageType.color)
                            .frame(width: 28, height: 28)

                        Text(damage.damageType.initial)
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(.white)
                    }

                    // Details
                    VStack(alignment: .leading, spacing: 2) {
                        Text(damage.damageType.displayName)
                            .font(.vroomxBodyBold)
                            .foregroundColor(.textPrimary)

                        if let desc = damage.description, !desc.isEmpty {
                            Text(desc)
                                .font(.vroomxCaption)
                                .foregroundColor(.textSecondary)
                                .lineLimit(1)
                        } else {
                            Text("Position: \(String(format: "%.0f%%", damage.xPosition * 100)), \(String(format: "%.0f%%", damage.yPosition * 100))")
                                .font(.vroomxCaption)
                                .foregroundColor(.textSecondary)
                        }
                    }

                    Spacer()

                    // Delete button
                    Button {
                        damages.removeAll { $0.id == damage.id }
                        let generator = UINotificationFeedbackGenerator()
                        generator.notificationOccurred(.warning)
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 18))
                            .foregroundColor(.textSecondary.opacity(0.5))
                    }
                    .buttonStyle(.plain)
                }
                .padding(10)
                .background(Color.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .strokeBorder(Color.textSecondary.opacity(0.1), lineWidth: 1)
                )
            }
        }
    }
}
