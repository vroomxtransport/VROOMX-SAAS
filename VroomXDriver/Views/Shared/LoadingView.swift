import SwiftUI

/// Centered loading indicator with VroomX branding.
/// Shows a ProgressView spinner with optional message text.
struct LoadingView: View {
    var message: String?

    var body: some View {
        VStack(spacing: 16) {
            ProgressView()
                .progressViewStyle(.circular)
                .tint(.brandPrimary)
                .scaleEffect(1.2)

            if let message {
                Text(message)
                    .font(.vroomxBody)
                    .foregroundColor(.textSecondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.appBackground)
    }
}

#Preview {
    LoadingView(message: "Loading trips...")
}
