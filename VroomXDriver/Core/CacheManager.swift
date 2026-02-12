import Foundation

/// Manages local JSON caching via UserDefaults for offline support.
/// All keys are prefixed with "vroomx_" to avoid collisions.
final class CacheManager {
    /// Shared singleton instance.
    static let shared = CacheManager()

    private let defaults = UserDefaults.standard
    private let keyPrefix = "vroomx_"

    private init() {}

    // MARK: - Save

    /// Encodes a `Codable` value to JSON and stores it in UserDefaults.
    func save<T: Codable>(_ value: T, forKey key: String) {
        let prefixedKey = keyPrefix + key
        do {
            let data = try JSONEncoder().encode(value)
            defaults.set(data, forKey: prefixedKey)
        } catch {
            print("[CacheManager] Failed to encode \(T.self) for key '\(key)': \(error)")
        }
    }

    // MARK: - Load

    /// Loads and decodes a `Codable` value from UserDefaults.
    /// Returns `nil` if the key doesn't exist or decoding fails.
    func load<T: Codable>(forKey key: String, as type: T.Type) -> T? {
        let prefixedKey = keyPrefix + key
        guard let data = defaults.data(forKey: prefixedKey) else {
            return nil
        }
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            print("[CacheManager] Failed to decode \(T.self) for key '\(key)': \(error)")
            return nil
        }
    }

    // MARK: - Remove

    /// Removes a cached value for the given key.
    func remove(forKey key: String) {
        let prefixedKey = keyPrefix + key
        defaults.removeObject(forKey: prefixedKey)
    }

    // MARK: - Clear All

    /// Removes all VroomX cached data. Call on logout for security.
    func clearAllCache() {
        let allKeys = defaults.dictionaryRepresentation().keys
        for key in allKeys where key.hasPrefix(keyPrefix) {
            defaults.removeObject(forKey: key)
        }
    }
}
