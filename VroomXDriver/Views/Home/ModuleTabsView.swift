import SwiftUI

/// Pill-shaped segmented picker for filtering orders by module category.
/// Shows count badges on each tab reflecting the number of orders in that category.
struct ModuleTabsView: View {
    @Binding var selectedModule: OrderModule
    let orderCounts: [OrderModule: Int]

    var body: some View {
        HStack(spacing: 6) {
            ForEach(OrderModule.allCases) { module in
                ModuleTabButton(
                    module: module,
                    count: orderCounts[module] ?? 0,
                    isSelected: selectedModule == module
                ) {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        selectedModule = module
                    }
                }
            }
        }
        .padding(4)
        .background(Color.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Module Tab Button

/// Individual tab button with pill selection indicator and count badge.
private struct ModuleTabButton: View {
    let module: OrderModule
    let count: Int
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Text(module.displayName)
                    .font(.vroomxCaptionSmall)
                    .fontWeight(isSelected ? .bold : .medium)

                if count > 0 {
                    Text("\(count)")
                        .font(.vroomxCaptionSmall)
                        .foregroundColor(isSelected ? .brandPrimary : .textSecondary)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 1)
                        .background(
                            Capsule()
                                .fill(isSelected
                                    ? Color.brandPrimary.opacity(0.15)
                                    : Color.textSecondary.opacity(0.12)
                                )
                        )
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .frame(maxWidth: .infinity)
            .foregroundColor(isSelected ? .brandPrimary : .textSecondary)
            .background(
                Group {
                    if isSelected {
                        RoundedRectangle(cornerRadius: 10)
                            .fill(Color.brandPrimary.opacity(0.12))
                    }
                }
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(module.displayName) tab, \(count) orders")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

#Preview {
    ModuleTabsView(
        selectedModule: .constant(.pickup),
        orderCounts: [
            .pickup: 3,
            .delivery: 2,
            .completed: 5,
            .archived: 1
        ]
    )
    .padding()
    .background(Color.appBackground)
}
