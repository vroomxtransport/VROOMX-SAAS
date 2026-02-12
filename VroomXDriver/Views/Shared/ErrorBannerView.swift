import SwiftUI

/// Red-tinted error banner with an exclamation icon, message, and optional retry button.
/// Dismissable with an X button.
struct ErrorBannerView: View {
    let message: String
    var retryAction: (() -> Void)?

    @State private var isDismissed = false

    var body: some View {
        if !isDismissed {
            HStack(spacing: 10) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.white)

                Text(message)
                    .font(.vroomxCaption)
                    .fontWeight(.medium)
                    .foregroundColor(.white)
                    .lineLimit(2)

                Spacer()

                if let retryAction {
                    Button {
                        retryAction()
                    } label: {
                        Text("Retry")
                            .font(.vroomxCaption)
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(Color.white.opacity(0.2))
                            .cornerRadius(4)
                    }
                }

                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        isDismissed = true
                    }
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(.white.opacity(0.8))
                }
            }
            .padding(.vertical, 10)
            .padding(.horizontal, 16)
            .background(Color.brandDanger.opacity(0.9))
            .cornerRadius(8)
            .transition(.move(edge: .top).combined(with: .opacity))
        }
    }
}

#Preview {
    VStack(spacing: 16) {
        ErrorBannerView(message: "Failed to load trips. Please try again.") {
            print("Retry tapped")
        }

        ErrorBannerView(message: "Something went wrong.")

        Spacer()
    }
    .padding()
}
