import SwiftUI

/// Root view that routes between LoginView and MainTabView
/// based on the driver's authentication state.
struct ContentView: View {
    @EnvironmentObject private var authManager: AuthManager

    /// Controls the splash/loading state while restoring session.
    @State private var isRestoringSession: Bool = true

    var body: some View {
        ZStack {
            if isRestoringSession {
                splashView
            } else if authManager.isAuthenticated {
                MainTabView()
                    .transition(.opacity)
            } else {
                LoginView()
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.3), value: authManager.isAuthenticated)
        .animation(.easeInOut(duration: 0.3), value: isRestoringSession)
        .task {
            await authManager.restoreSession()
            withAnimation {
                isRestoringSession = false
            }
        }
    }

    // MARK: - Splash View

    /// Displayed while the app checks for an existing session on launch.
    private var splashView: some View {
        ZStack {
            Color.appBackground
                .ignoresSafeArea()

            VStack(spacing: 16) {
                Image(systemName: "truck.box.fill")
                    .font(.system(size: 64))
                    .foregroundColor(.brandPrimary)

                Text("VroomX")
                    .font(.vroomxTitleLarge)
                    .foregroundColor(.textPrimary)

                ProgressView()
                    .tint(.brandPrimary)
                    .padding(.top, 8)
            }
        }
    }
}
