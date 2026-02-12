import SwiftUI

// MARK: - Login Phase

/// Tracks the current step of the multi-phase login flow.
private enum LoginPhase {
    case emailEntry       // First login: enter email
    case otpVerify        // First login: verify OTP code
    case pinSetup         // First login: create PIN after OTP
    case biometricPrompt  // First login: optional biometric enrollment
    case pinEntry         // Returning: enter PIN
    case biometricEntry   // Returning: Face ID / Touch ID
}

// MARK: - Login View

/// Multi-phase authentication view supporting:
/// - Path A (First login): email -> OTP verify -> PIN setup -> biometric prompt
/// - Path B (Returning, PIN): VroomX logo + 4-digit PIN entry
/// - Path C (Returning, biometric): Face ID button with PIN fallback
struct LoginView: View {
    @EnvironmentObject private var authManager: AuthManager

    @State private var phase: LoginPhase = .emailEntry
    @State private var email: String = ""
    @State private var otpCode: String = ""
    @State private var pin: String = ""
    @State private var confirmPin: String = ""
    @State private var isConfirmingPIN: Bool = false
    @State private var showPINMismatch: Bool = false

    var body: some View {
        ZStack {
            Color.appBackground
                .ignoresSafeArea()

            VStack(spacing: 32) {
                Spacer()

                // Logo and branding
                logoSection

                Spacer()
                    .frame(height: 8)

                // Phase-specific content
                switch phase {
                case .emailEntry:
                    emailEntrySection
                case .otpVerify:
                    otpVerifySection
                case .pinSetup:
                    pinSetupSection
                case .biometricPrompt:
                    biometricPromptSection
                case .pinEntry:
                    pinEntrySection
                case .biometricEntry:
                    biometricEntrySection
                }

                Spacer()

                // Error display
                if let error = authManager.error {
                    Text(error)
                        .font(.vroomxCaption)
                        .foregroundColor(.brandDanger)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 24)
                }
            }
            .padding(.horizontal, 32)

            // Loading overlay
            if authManager.isLoading {
                Color.black.opacity(0.3)
                    .ignoresSafeArea()
                ProgressView()
                    .tint(.white)
                    .scaleEffect(1.2)
            }
        }
        .onAppear {
            determineInitialPhase()
        }
    }

    // MARK: - Logo Section

    private var logoSection: some View {
        VStack(spacing: 12) {
            Image(systemName: "truck.box.fill")
                .font(.system(size: 56))
                .foregroundColor(.brandPrimary)

            Text("VroomX")
                .font(.vroomxTitleLarge)
                .foregroundColor(.textPrimary)

            if phase == .pinEntry || phase == .biometricEntry {
                Text("Welcome back")
                    .font(.vroomxBody)
                    .foregroundColor(.textSecondary)
            } else if phase == .emailEntry {
                Text("Driver Sign In")
                    .font(.vroomxBody)
                    .foregroundColor(.textSecondary)
            }
        }
    }

    // MARK: - Path A: Email Entry

    private var emailEntrySection: some View {
        VStack(spacing: 20) {
            Text("Enter your email to receive a sign-in code")
                .font(.vroomxBody)
                .foregroundColor(.textSecondary)
                .multilineTextAlignment(.center)

            TextField("Email address", text: $email)
                .textFieldStyle(VroomXTextFieldStyle())
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .autocapitalization(.none)
                .disableAutocorrection(true)

            Button(action: {
                Task { await sendOTP() }
            }) {
                Text("Send Code")
                    .font(.vroomxBodyBold)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(Color.brandPrimary)
                    .cornerRadius(12)
            }
            .disabled(email.isEmpty || authManager.isLoading)
            .opacity(email.isEmpty ? 0.5 : 1.0)
        }
    }

    // MARK: - Path A: OTP Verify

    private var otpVerifySection: some View {
        VStack(spacing: 20) {
            Text("Enter the 6-digit code sent to")
                .font(.vroomxBody)
                .foregroundColor(.textSecondary)

            Text(email)
                .font(.vroomxBodyBold)
                .foregroundColor(.brandPrimary)

            TextField("000000", text: $otpCode)
                .textFieldStyle(VroomXTextFieldStyle())
                .keyboardType(.numberPad)
                .multilineTextAlignment(.center)
                .onChange(of: otpCode) { _, newValue in
                    // Limit to 6 digits
                    if newValue.count > 6 {
                        otpCode = String(newValue.prefix(6))
                    }
                }

            Button(action: {
                Task { await verifyOTP() }
            }) {
                Text("Verify Code")
                    .font(.vroomxBodyBold)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(Color.brandPrimary)
                    .cornerRadius(12)
            }
            .disabled(otpCode.count != 6 || authManager.isLoading)
            .opacity(otpCode.count != 6 ? 0.5 : 1.0)

            Button("Resend code") {
                Task { await sendOTP() }
            }
            .font(.vroomxCaption)
            .foregroundColor(.textSecondary)

            Button("Use different email") {
                phase = .emailEntry
                otpCode = ""
                authManager.error = nil
            }
            .font(.vroomxCaption)
            .foregroundColor(.textSecondary)
        }
    }

    // MARK: - Path A: PIN Setup

    private var pinSetupSection: some View {
        VStack(spacing: 20) {
            Text(isConfirmingPIN ? "Confirm your PIN" : "Create a 4-digit PIN")
                .font(.vroomxTitle)
                .foregroundColor(.textPrimary)

            Text(isConfirmingPIN
                 ? "Enter your PIN again to confirm"
                 : "You'll use this PIN to quickly unlock the app")
                .font(.vroomxBody)
                .foregroundColor(.textSecondary)
                .multilineTextAlignment(.center)

            PINEntryView(pin: isConfirmingPIN ? $confirmPin : $pin)

            if showPINMismatch {
                Text("PINs don't match. Please try again.")
                    .font(.vroomxCaption)
                    .foregroundColor(.brandDanger)
            }
        }
        .onChange(of: pin) { _, newValue in
            if !isConfirmingPIN && newValue.count == 4 {
                isConfirmingPIN = true
                showPINMismatch = false
            }
        }
        .onChange(of: confirmPin) { _, newValue in
            if isConfirmingPIN && newValue.count == 4 {
                if confirmPin == pin {
                    Task { await savePIN() }
                } else {
                    showPINMismatch = true
                    pin = ""
                    confirmPin = ""
                    isConfirmingPIN = false
                }
            }
        }
    }

    // MARK: - Path A: Biometric Prompt

    private var biometricPromptSection: some View {
        VStack(spacing: 24) {
            Image(systemName: biometricIcon)
                .font(.system(size: 64))
                .foregroundColor(.brandPrimary)

            Text("Enable \(authManager.biometricTypeName)?")
                .font(.vroomxTitle)
                .foregroundColor(.textPrimary)

            Text("Sign in faster with \(authManager.biometricTypeName) next time")
                .font(.vroomxBody)
                .foregroundColor(.textSecondary)
                .multilineTextAlignment(.center)

            Button(action: {
                Task { await enableBiometric() }
            }) {
                Text("Enable \(authManager.biometricTypeName)")
                    .font(.vroomxBodyBold)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(Color.brandPrimary)
                    .cornerRadius(12)
            }

            Button("Skip for now") {
                // Authentication is already complete from OTP + PIN
                // currentDriver and isAuthenticated already set
            }
            .font(.vroomxCaption)
            .foregroundColor(.textSecondary)
        }
    }

    // MARK: - Path B: Returning PIN Entry

    private var pinEntrySection: some View {
        VStack(spacing: 20) {
            Text("Enter your PIN")
                .font(.vroomxTitle)
                .foregroundColor(.textPrimary)

            PINEntryView(pin: $pin)

            if authManager.isBiometricEnabled && authManager.isBiometricAvailable {
                Button(action: {
                    phase = .biometricEntry
                    Task { await authenticateWithBiometric() }
                }) {
                    Label("Use \(authManager.biometricTypeName)", systemImage: biometricIcon)
                        .font(.vroomxBodyBold)
                        .foregroundColor(.brandPrimary)
                }
                .padding(.top, 8)
            }
        }
        .onChange(of: pin) { _, newValue in
            if newValue.count == 4 {
                Task { await verifyPIN() }
            }
        }
    }

    // MARK: - Path C: Returning Biometric Entry

    private var biometricEntrySection: some View {
        VStack(spacing: 24) {
            Image(systemName: biometricIcon)
                .font(.system(size: 64))
                .foregroundColor(.brandPrimary)

            Button(action: {
                Task { await authenticateWithBiometric() }
            }) {
                Text("Sign in with \(authManager.biometricTypeName)")
                    .font(.vroomxBodyBold)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(Color.brandPrimary)
                    .cornerRadius(12)
            }

            Button("Use PIN instead") {
                phase = .pinEntry
                pin = ""
            }
            .font(.vroomxCaption)
            .foregroundColor(.textSecondary)
        }
        .onAppear {
            Task { await authenticateWithBiometric() }
        }
    }

    // MARK: - Helpers

    private var biometricIcon: String {
        let context = LAContext()
        _ = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
        switch context.biometryType {
        case .faceID: return "faceid"
        case .touchID: return "touchid"
        case .opticID: return "opticid"
        @unknown default: return "lock.shield"
        }
    }

    /// Determines which phase to show based on existing credentials.
    private func determineInitialPhase() {
        if authManager.isBiometricEnabled && authManager.isBiometricAvailable {
            phase = .biometricEntry
        } else if authManager.isPINConfigured {
            phase = .pinEntry
        } else {
            phase = .emailEntry
        }
    }

    // MARK: - Actions

    private func sendOTP() async {
        do {
            try await authManager.sendOTP(email: email)
            phase = .otpVerify
        } catch {
            // Error already set on authManager
        }
    }

    private func verifyOTP() async {
        do {
            try await authManager.verifyOTP(email: email, code: otpCode)
            // OTP verified, driver record loaded — proceed to PIN setup
            phase = .pinSetup
        } catch {
            // Error already set on authManager
        }
    }

    private func savePIN() async {
        do {
            try await authManager.setupPIN(pin: pin)

            // If biometric is available, offer enrollment
            if authManager.isBiometricAvailable {
                phase = .biometricPrompt
            }
            // Otherwise, authentication is complete (isAuthenticated already true)
        } catch {
            // Error already set on authManager
        }
    }

    private func enableBiometric() async {
        await authManager.setupBiometric()
        // Authentication already complete — ContentView will switch to MainTabView
    }

    private func verifyPIN() async {
        let success = await authManager.verifyPIN(pin: pin)
        if !success {
            authManager.error = "Incorrect PIN. Please try again."
            pin = ""
        }
    }

    private func authenticateWithBiometric() async {
        let success = await authManager.authenticateWithBiometrics()
        if !success {
            // Fallback to PIN
            phase = .pinEntry
            pin = ""
        }
    }
}

// MARK: - PIN Entry View

/// Displays 4 circles that fill as the user enters digits.
private struct PINEntryView: View {
    @Binding var pin: String

    var body: some View {
        VStack(spacing: 16) {
            // PIN dots
            HStack(spacing: 20) {
                ForEach(0..<4, id: \.self) { index in
                    Circle()
                        .fill(index < pin.count ? Color.brandPrimary : Color.clear)
                        .frame(width: 16, height: 16)
                        .overlay(
                            Circle()
                                .stroke(Color.brandPrimary, lineWidth: 2)
                        )
                }
            }

            // Number pad
            VStack(spacing: 12) {
                ForEach(0..<3) { row in
                    HStack(spacing: 24) {
                        ForEach(1...3, id: \.self) { col in
                            let digit = row * 3 + col
                            numberButton(digit: "\(digit)")
                        }
                    }
                }

                // Bottom row: empty - 0 - delete
                HStack(spacing: 24) {
                    Color.clear
                        .frame(width: 72, height: 72)

                    numberButton(digit: "0")

                    Button(action: {
                        if !pin.isEmpty {
                            pin.removeLast()
                        }
                    }) {
                        Image(systemName: "delete.left.fill")
                            .font(.system(size: 22))
                            .foregroundColor(.textPrimary)
                            .frame(width: 72, height: 72)
                    }
                }
            }
        }
    }

    private func numberButton(digit: String) -> some View {
        Button(action: {
            if pin.count < 4 {
                pin += digit
            }
        }) {
            Text(digit)
                .font(.system(size: 28, weight: .medium))
                .foregroundColor(.textPrimary)
                .frame(width: 72, height: 72)
                .background(Color.cardBackground)
                .cornerRadius(36)
        }
    }
}

// MARK: - VroomX Text Field Style

/// Custom text field style matching VroomX brand design.
struct VroomXTextFieldStyle: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .padding(16)
            .font(.vroomxBody)
            .background(Color.cardBackground)
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.textSecondary.opacity(0.3), lineWidth: 1)
            )
    }
}
