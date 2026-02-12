import SwiftUI

// MARK: - Vehicle Diagram View

/// Interactive vehicle diagram component that allows tap-to-place, drag, and
/// long-press edit/delete of damage markers.
///
/// Damage coordinates are stored as normalized x/y (0-1 range) relative to
/// the diagram bounds, ensuring consistent positioning across screen sizes.
struct VehicleDiagramView: View {
    let vehicleType: String
    let currentView: VehicleDiagrams.DiagramView
    @Binding var damages: [LocalDamage]

    /// Currently selected damage type for new markers.
    let selectedDamageType: DamageType

    /// Callback when a damage marker is tapped for editing.
    var onEditDamage: ((LocalDamage) -> Void)?

    // MARK: - State

    @State private var diagramSize: CGSize = .zero
    @State private var draggingDamageId: String?
    @State private var showDeleteAlert = false
    @State private var damageToDelete: LocalDamage?
    @State private var showEditSheet = false
    @State private var damageToEdit: LocalDamage?

    // MARK: - Filtered Damages

    /// Damages for the current diagram view only.
    private var viewDamages: [LocalDamage] {
        damages.filter { $0.view == currentView.rawValue }
    }

    // MARK: - Body

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Vehicle outline
                VehicleDiagrams.outline(for: vehicleType, view: currentView)
                    .stroke(Color.textSecondary.opacity(0.6), lineWidth: 1.5)
                    .background(
                        VehicleDiagrams.outline(for: vehicleType, view: currentView)
                            .fill(Color.cardBackground)
                    )
                    .aspectRatio(1.0, contentMode: .fit)

                // Damage markers overlay
                ForEach(viewDamages) { damage in
                    damageMarker(for: damage, in: geometry.size)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .contentShape(Rectangle())
            .onTapGesture { location in
                let normalized = normalizePosition(location, in: geometry.size)
                addDamage(at: normalized)
            }
            .onAppear {
                diagramSize = geometry.size
            }
            .onChange(of: geometry.size) { _, newSize in
                diagramSize = newSize
            }
        }
        .aspectRatio(1.0, contentMode: .fit)
        .alert("Delete Damage?", isPresented: $showDeleteAlert) {
            Button("Delete", role: .destructive) {
                if let damage = damageToDelete {
                    deleteDamage(damage)
                }
            }
            Button("Cancel", role: .cancel) {
                damageToDelete = nil
            }
        } message: {
            if let damage = damageToDelete {
                Text("Remove this \(damage.damageType.displayName.lowercased()) marker?")
            }
        }
        .sheet(isPresented: $showEditSheet) {
            if let damage = damageToEdit {
                DamageEditSheet(
                    damage: damage,
                    onSave: { updatedDamage in
                        updateDamage(updatedDamage)
                        showEditSheet = false
                        damageToEdit = nil
                    },
                    onDelete: {
                        deleteDamage(damage)
                        showEditSheet = false
                        damageToEdit = nil
                    },
                    onCancel: {
                        showEditSheet = false
                        damageToEdit = nil
                    }
                )
                .presentationDetents([.medium])
            }
        }
    }

    // MARK: - Damage Marker

    @ViewBuilder
    private func damageMarker(for damage: LocalDamage, in size: CGSize) -> some View {
        let position = denormalizePosition(x: damage.xPosition, y: damage.yPosition, in: size)

        ZStack {
            // Outer ring
            Circle()
                .fill(damage.damageType.color.opacity(0.3))
                .frame(width: 36, height: 36)

            // Inner circle with initial
            Circle()
                .fill(damage.damageType.color)
                .frame(width: 26, height: 26)
                .overlay {
                    Text(damage.damageType.initial)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(.white)
                }

            // Shadow
            Circle()
                .fill(Color.clear)
                .frame(width: 36, height: 36)
                .shadow(color: damage.damageType.color.opacity(0.4), radius: 4, x: 0, y: 2)
        }
        .scaleEffect(draggingDamageId == damage.id ? 1.3 : 1.0)
        .animation(.spring(response: 0.3, dampingFraction: 0.6), value: draggingDamageId)
        .position(x: position.x, y: position.y)
        .gesture(
            DragGesture()
                .onChanged { value in
                    draggingDamageId = damage.id
                    let normalized = normalizePosition(value.location, in: size)
                    moveDamage(id: damage.id, to: normalized)
                }
                .onEnded { _ in
                    draggingDamageId = nil
                }
        )
        .simultaneousGesture(
            LongPressGesture(minimumDuration: 0.5)
                .onEnded { _ in
                    damageToEdit = damage
                    showEditSheet = true
                }
        )
    }

    // MARK: - Coordinate Normalization

    /// Convert a screen position to normalized (0-1) coordinates.
    private func normalizePosition(_ point: CGPoint, in size: CGSize) -> CGPoint {
        guard size.width > 0, size.height > 0 else { return .zero }
        return CGPoint(
            x: max(0, min(1, point.x / size.width)),
            y: max(0, min(1, point.y / size.height))
        )
    }

    /// Convert normalized (0-1) coordinates back to screen position.
    private func denormalizePosition(x: Double, y: Double, in size: CGSize) -> CGPoint {
        CGPoint(
            x: x * size.width,
            y: y * size.height
        )
    }

    // MARK: - Damage Operations

    private func addDamage(at point: CGPoint) {
        let damage = LocalDamage(
            damageType: selectedDamageType,
            view: currentView.rawValue,
            xPosition: point.x,
            yPosition: point.y
        )
        damages.append(damage)

        // Haptic feedback
        let generator = UIImpactFeedbackGenerator(style: .medium)
        generator.impactOccurred()
    }

    private func moveDamage(id: String, to point: CGPoint) {
        guard let index = damages.firstIndex(where: { $0.id == id }) else { return }
        damages[index].xPosition = point.x
        damages[index].yPosition = point.y
    }

    private func updateDamage(_ updated: LocalDamage) {
        guard let index = damages.firstIndex(where: { $0.id == updated.id }) else { return }
        damages[index] = updated
    }

    private func deleteDamage(_ damage: LocalDamage) {
        damages.removeAll { $0.id == damage.id }

        // Haptic feedback
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.warning)
    }
}

// MARK: - Damage Edit Sheet

/// Sheet for editing a damage marker's type and description, or deleting it.
struct DamageEditSheet: View {
    @State var damage: LocalDamage
    let onSave: (LocalDamage) -> Void
    let onDelete: () -> Void
    let onCancel: () -> Void

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                // Damage type selector
                VStack(alignment: .leading, spacing: 8) {
                    Text("Damage Type")
                        .font(.vroomxBodyBold)
                        .foregroundColor(.textPrimary)

                    HStack(spacing: 8) {
                        ForEach(DamageType.allCases) { type in
                            Button {
                                damage.damageType = type
                            } label: {
                                VStack(spacing: 4) {
                                    ZStack {
                                        Circle()
                                            .fill(type.color.opacity(damage.damageType == type ? 1.0 : 0.3))
                                            .frame(width: 40, height: 40)

                                        Text(type.initial)
                                            .font(.system(size: 16, weight: .bold))
                                            .foregroundColor(damage.damageType == type ? .white : type.color)
                                    }

                                    Text(type.displayName)
                                        .font(.vroomxCaptionSmall)
                                        .foregroundColor(damage.damageType == type ? type.color : .textSecondary)
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                // Description
                VStack(alignment: .leading, spacing: 8) {
                    Text("Description (optional)")
                        .font(.vroomxBodyBold)
                        .foregroundColor(.textPrimary)

                    TextField("e.g. Small scratch near door handle", text: Binding(
                        get: { damage.description ?? "" },
                        set: { damage.description = $0.isEmpty ? nil : $0 }
                    ))
                    .font(.vroomxBody)
                    .padding(12)
                    .background(Color.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .strokeBorder(Color.textSecondary.opacity(0.2), lineWidth: 1)
                    )
                }

                Spacer()

                // Delete button
                Button(role: .destructive) {
                    onDelete()
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "trash.fill")
                        Text("Delete Damage")
                    }
                    .font(.vroomxBodyBold)
                    .foregroundColor(.brandDanger)
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(Color.brandDanger.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            }
            .padding(16)
            .navigationTitle("Edit Damage")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        onCancel()
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") {
                        onSave(damage)
                    }
                    .fontWeight(.semibold)
                }
            }
        }
    }
}
