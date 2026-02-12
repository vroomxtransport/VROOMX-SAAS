import SwiftUI
import UIKit

/// Inline button that opens an address in Google Maps (preferred) or Apple Maps (fallback).
/// Uses `UIApplication.shared.canOpenURL` to detect Google Maps availability.
struct MapLinkButton: View {
    let address: String

    var body: some View {
        Button {
            openInMaps()
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "map.fill")
                    .font(.system(size: 12, weight: .medium))

                Text("Open in Maps")
                    .font(.vroomxCaption)
            }
            .foregroundColor(.brandPrimary)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color.brandPrimary.opacity(0.1))
            .cornerRadius(8)
        }
    }

    // MARK: - Maps Integration

    private func openInMaps() {
        guard !address.isEmpty else { return }

        let encoded = address.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? address

        // Try Google Maps first
        let googleMapsURL = URL(string: "comgooglemaps://?q=\(encoded)")
        let appleMapsURL = URL(string: "maps://?q=\(encoded)")

        if let googleURL = googleMapsURL,
           UIApplication.shared.canOpenURL(googleURL) {
            UIApplication.shared.open(googleURL)
        } else if let appleURL = appleMapsURL {
            UIApplication.shared.open(appleURL)
        }
    }
}

#Preview {
    VStack(spacing: 16) {
        MapLinkButton(address: "123 Main St, Dallas, TX 75201")
        MapLinkButton(address: "456 Oak Ave, Houston, TX 77001")
    }
    .padding()
}
