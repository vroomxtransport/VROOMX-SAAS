import Foundation
import Supabase

/// Singleton Supabase client for all database, auth, and storage operations.
/// Reads configuration from `Config.supabaseURL` and `Config.supabaseAnonKey`.
final class SupabaseManager {
    /// Shared singleton instance.
    static let shared = SupabaseManager()

    /// The Supabase client configured with VroomX project credentials.
    let client: SupabaseClient

    private init() {
        guard let url = URL(string: Config.supabaseURL) else {
            fatalError("Invalid Supabase URL in Config.supabaseURL")
        }

        client = SupabaseClient(
            supabaseURL: url,
            supabaseKey: Config.supabaseAnonKey
        )
    }
}
