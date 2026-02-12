import SwiftUI

/// Amber banner shown when the device is offline.
/// Displays a wifi.slash icon and cached data message.
/// Animates in/out with a slide transition.
struct OfflineBanner: View {
    @ObservedObject private var networkMonitor = NetworkMonitor.shared

    var body: some View {
        if !networkMonitor.isConnected {
            HStack(spacing: 8) {
                Image(systemName: "wifi.slash")
                    .font(.system(size: 14, weight: .semibold))

                Text("You're offline -- showing cached data")
                    .font(.vroomxCaption)
                    .fontWeight(.medium)
            }
            .foregroundColor(.black.opacity(0.85))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .padding(.horizontal, 16)
            .background(Color.brandWarning.opacity(0.9))
            .transition(.move(edge: .top).combined(with: .opacity))
            .animation(.easeInOut(duration: 0.3), value: networkMonitor.isConnected)
        }
    }
}

#Preview {
    VStack {
        OfflineBanner()
        Spacer()
    }
}
