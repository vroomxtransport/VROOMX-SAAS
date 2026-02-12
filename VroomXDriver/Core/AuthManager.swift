import Foundation
import Supabase
import LocalAuthentication
import KeychainAccess
import CryptoKit

// MARK: - Auth State

/// Represents the current authentication state of the driver.
enum AuthState: Equatable {
    case unauthenticated
    case awaitingOTP
    case authenticated
    case biometricAvailable
}

// MARK: - Auth Manager

/// Manages email OTP authentication, biometric unlock, PIN quick-access,
/// and session lifecycle for the VroomX driver app.
@MainActor
final class AuthManager: ObservableObject {

    // MARK: - Published State

    /// Whether the driver is fully authenticated (session valid + driver record loaded).
    @Published var isAuthenticated: Bool = false

    /// The linked driver record for the current auth user.
    @Published var currentDriver: VroomXDriverModel?

    /// Loading indicator for async auth operations.
    @Published var isLoading: Bool = false

    /// User-facing error message from the last failed operation.
    @Published var error: String?

    /// Current step in the authentication flow.
    @Published var authState: AuthState = .unauthenticated

    // MARK: - Private

    private let supabase = SupabaseManager.shared.client
    private let keychain = Keychain(service: Config.keychainService)

    /// UserDefaults key for biometric enrollment flag.
    private let biometricEnabledKey = "vroomx_biometric_enabled"

    /// Whether biometric unlock has been set up by the driver.
    var isBiometricEnabled: Bool {
        UserDefaults.standard.bool(forKey: biometricEnabledKey)
    }

    /// Whether the device supports biometric authentication (Face ID or Touch ID).
    var isBiometricAvailable: Bool {
        let context = LAContext()
        var authError: NSError?
        return context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &authError)
    }

    /// Whether a PIN has been configured (stored in Keychain).
    var isPINConfigured: Bool {
        (try? keychain.get(Config.keychainPINKey)) != nil
    }

    // MARK: - Email OTP Flow

    /// Sends a magic link / OTP code to the driver's email address.
    /// Sets authState to `.awaitingOTP` on success.
    func sendOTP(email: String) async throws {
        isLoading = true
        error = nil
        defer { isLoading = false }

        do {
            try await supabase.auth.signInWithOTP(email: email)
            authState = .awaitingOTP
        } catch {
            self.error = "Failed to send verification code: \(error.localizedDescription)"
            throw error
        }
    }

    /// Verifies the OTP code entered by the driver.
    /// On success, fetches the driver record and completes authentication.
    func verifyOTP(email: String, code: String) async throws {
        isLoading = true
        error = nil
        defer { isLoading = false }

        do {
            try await supabase.auth.verifyOTP(
                email: email,
                token: code,
                type: .email
            )

            // Fetch auth user to get the user ID
            let user = try await supabase.auth.user()
            await fetchDriverRecord(authUserId: user.id.uuidString)
        } catch {
            self.error = "Invalid verification code. Please try again."
            throw error
        }
    }

    // MARK: - Driver Record Linking

    /// Queries the `drivers` table for a record linked to the authenticated user.
    /// Sets `currentDriver` and `isAuthenticated` on success.
    func fetchDriverRecord(authUserId: String) async {
        do {
            let drivers: [VroomXDriverModel] = try await supabase
                .from("drivers")
                .select()
                .eq("auth_user_id", value: authUserId)
                .limit(1)
                .execute()
                .value

            if let driver = drivers.first {
                currentDriver = driver
                isAuthenticated = true
                authState = .authenticated

                // Cache driver record for offline access
                CacheManager.shared.save(driver, forKey: Config.cachedDriverKey)
            } else {
                self.error = "No driver account found. Contact your dispatcher."
                isAuthenticated = false
                authState = .unauthenticated
            }
        } catch {
            self.error = "Failed to load driver profile: \(error.localizedDescription)"
            isAuthenticated = false
        }
    }

    // MARK: - Biometric Unlock (Face ID / Touch ID)

    /// Prompts the driver to enroll in biometric authentication.
    /// Stores enrollment flag in UserDefaults.
    func setupBiometric() async {
        let context = LAContext()
        var authError: NSError?

        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &authError) else {
            self.error = "Biometric authentication is not available on this device."
            return
        }

        do {
            let success = try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: "Enable \(biometricTypeName) for quick sign-in"
            )
            if success {
                UserDefaults.standard.set(true, forKey: biometricEnabledKey)
            }
        } catch {
            // Driver declined or biometric failed — not a critical error
            print("[AuthManager] Biometric setup declined: \(error.localizedDescription)")
        }
    }

    /// Attempts biometric authentication. On success, restores the Supabase session
    /// and loads the driver record.
    func authenticateWithBiometrics() async -> Bool {
        let context = LAContext()

        do {
            let success = try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: "Sign in to VroomX"
            )

            guard success else { return false }

            // Biometric passed — restore the existing Supabase session
            return await restoreSessionSilently()
        } catch {
            print("[AuthManager] Biometric auth failed: \(error.localizedDescription)")
            return false
        }
    }

    /// Human-readable name for the biometric type on this device.
    var biometricTypeName: String {
        let context = LAContext()
        _ = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
        switch context.biometryType {
        case .faceID: return "Face ID"
        case .touchID: return "Touch ID"
        case .opticID: return "Optic ID"
        @unknown default: return "Biometrics"
        }
    }

    // MARK: - PIN Quick-Access

    /// Hashes the PIN with SHA-256 and stores it in both Keychain and the driver's DB record.
    func setupPIN(pin: String) async throws {
        let hash = hashPIN(pin)

        // Store in Keychain for local verification
        try keychain.set(hash, key: Config.keychainPINKey)

        // Update the driver's pin_hash in the database
        if let driverId = currentDriver?.id {
            do {
                try await supabase
                    .from("drivers")
                    .update(["pin_hash": hash])
                    .eq("id", value: driverId)
                    .execute()
            } catch {
                self.error = "Failed to save PIN to server: \(error.localizedDescription)"
                throw error
            }
        }
    }

    /// Verifies a PIN against the stored Keychain hash.
    /// Returns true if the PIN matches.
    func verifyPIN(pin: String) async -> Bool {
        guard let storedHash = try? keychain.get(Config.keychainPINKey) else {
            return false
        }
        let inputHash = hashPIN(pin)
        guard storedHash == inputHash else { return false }

        // PIN verified — restore session
        return await restoreSessionSilently()
    }

    /// SHA-256 hash of the PIN string.
    private func hashPIN(_ pin: String) -> String {
        let data = Data(pin.utf8)
        let digest = SHA256.hash(data: data)
        return digest.map { String(format: "%02x", $0) }.joined()
    }

    // MARK: - Session Management

    /// Attempts to restore an existing Supabase session on app launch.
    /// If valid, fetches the driver record and sets authenticated state.
    func restoreSession() async {
        isLoading = true
        defer { isLoading = false }

        guard await restoreSessionSilently() else {
            // No valid session — check if biometric/PIN available for returning user
            if isBiometricEnabled && isBiometricAvailable {
                authState = .biometricAvailable
            } else if isPINConfigured {
                authState = .unauthenticated // Will show PIN entry for returning user
            } else {
                authState = .unauthenticated
            }
            return
        }
    }

    /// Internal session restore without loading state changes.
    /// Returns true if session was restored and driver record loaded.
    private func restoreSessionSilently() async -> Bool {
        do {
            let session = try await supabase.auth.session
            let userId = session.user.id.uuidString
            await fetchDriverRecord(authUserId: userId)
            return isAuthenticated
        } catch {
            print("[AuthManager] Session restore failed: \(error.localizedDescription)")
            return false
        }
    }

    /// Signs out the driver, clears all cached data and Keychain tokens.
    func logout() async {
        do {
            try await supabase.auth.signOut()
        } catch {
            print("[AuthManager] Sign out error: \(error.localizedDescription)")
        }

        // Clear local state
        isAuthenticated = false
        currentDriver = nil
        authState = .unauthenticated
        error = nil

        // Clear Keychain
        try? keychain.remove(Config.keychainPINKey)

        // Clear biometric flag
        UserDefaults.standard.removeObject(forKey: biometricEnabledKey)

        // Deregister push notification token
        await NotificationManager.shared.deregisterDeviceToken()

        // Clear all cached data
        CacheManager.shared.clearAllCache()
    }
}
