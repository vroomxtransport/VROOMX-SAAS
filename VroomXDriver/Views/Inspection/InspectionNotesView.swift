import SwiftUI
import CoreLocation

// MARK: - Interior Condition

/// Interior condition rating for vehicle inspection step 4.
enum InteriorCondition: String, CaseIterable, Identifiable {
    case excellent = "Excellent"
    case good = "Good"
    case fair = "Fair"
    case poor = "Poor"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .excellent: return "star.fill"
        case .good: return "hand.thumbsup.fill"
        case .fair: return "minus.circle.fill"
        case .poor: return "exclamationmark.triangle.fill"
        }
    }

    var color: Color {
        switch self {
        case .excellent: return .brandSuccess
        case .good: return .brandPrimary
        case .fair: return .brandWarning
        case .poor: return .brandDanger
        }
    }
}

// MARK: - Inspection Location Manager

/// Lightweight location manager for capturing GPS coordinates during inspection.
/// Uses CoreLocation's CLLocationManager with requestWhenInUseAuthorization.
final class InspectionLocationManager: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published var latitude: Double?
    @Published var longitude: Double?
    @Published var address: String?
    @Published var isCapturing: Bool = false
    @Published var capturedAt: Date?
    @Published var errorMessage: String?

    private let locationManager = CLLocationManager()
    private let geocoder = CLGeocoder()

    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
    }

    /// Request location permission and start capturing.
    func requestLocation() {
        isCapturing = true
        errorMessage = nil

        let status = locationManager.authorizationStatus
        switch status {
        case .notDetermined:
            locationManager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse, .authorizedAlways:
            locationManager.requestLocation()
        case .denied, .restricted:
            isCapturing = false
            errorMessage = "Location access denied. Enable in Settings."
        @unknown default:
            isCapturing = false
            errorMessage = "Unknown location authorization status."
        }
    }

    // MARK: - CLLocationManagerDelegate

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }

        DispatchQueue.main.async { [weak self] in
            self?.latitude = location.coordinate.latitude
            self?.longitude = location.coordinate.longitude
            self?.capturedAt = Date()
            self?.isCapturing = false
        }

        // Reverse geocode for address
        geocoder.reverseGeocodeLocation(location) { [weak self] placemarks, error in
            DispatchQueue.main.async {
                if let placemark = placemarks?.first {
                    let parts = [
                        placemark.subThoroughfare,
                        placemark.thoroughfare,
                        placemark.locality,
                        placemark.administrativeArea,
                        placemark.postalCode
                    ].compactMap { $0 }
                    self?.address = parts.joined(separator: " ")
                } else if let error = error {
                    print("[InspectionLocationManager] Geocode error: \(error.localizedDescription)")
                    self?.address = nil
                }
            }
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        DispatchQueue.main.async { [weak self] in
            self?.isCapturing = false
            self?.errorMessage = "Failed to get location: \(error.localizedDescription)"
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        if status == .authorizedWhenInUse || status == .authorizedAlways {
            manager.requestLocation()
        }
    }
}

// MARK: - Inspection Notes View

/// Step 4 of the inspection flow.
/// Captures odometer reading, interior condition, free-text notes, and GPS location.
struct InspectionNotesView: View {
    @Binding var odometerReading: String
    @Binding var interiorCondition: InteriorCondition
    @Binding var notes: String
    @Binding var gpsLatitude: Double?
    @Binding var gpsLongitude: Double?
    @Binding var gpsAddress: String?

    @StateObject private var locationManager = InspectionLocationManager()

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // MARK: - Header
                stepHeader

                // MARK: - Odometer
                odometerSection

                // MARK: - Interior Condition
                interiorConditionSection

                // MARK: - Notes
                notesSection

                // MARK: - GPS Location
                locationSection
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .onAppear {
            if gpsLatitude == nil {
                locationManager.requestLocation()
            }
        }
        .onChange(of: locationManager.latitude) { _, newValue in
            gpsLatitude = newValue
        }
        .onChange(of: locationManager.longitude) { _, newValue in
            gpsLongitude = newValue
        }
        .onChange(of: locationManager.address) { _, newValue in
            gpsAddress = newValue
        }
    }

    // MARK: - Step Header

    private var stepHeader: some View {
        VStack(spacing: 4) {
            HStack {
                Image(systemName: "doc.text.fill")
                    .font(.system(size: 20))
                    .foregroundColor(.brandPrimary)
                Text("Vehicle Condition Notes")
                    .font(.vroomxTitleMedium)
                    .foregroundColor(.textPrimary)
                Spacer()
            }
            HStack {
                Text("Step 4 of 6")
                    .font(.vroomxCaption)
                    .foregroundColor(.textSecondary)
                Spacer()
            }
        }
    }

    // MARK: - Odometer Section

    private var odometerSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Odometer Reading", systemImage: "gauge.with.dots.needle.33percent")
                .font(.vroomxBodyBold)
                .foregroundColor(.textPrimary)

            HStack {
                TextField("Enter mileage", text: $odometerReading)
                    .keyboardType(.numberPad)
                    .font(.vroomxMono)
                    .padding(12)
                    .background(Color.cardBackground)
                    .cornerRadius(10)
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(Color.textSecondary.opacity(0.2), lineWidth: 1)
                    )

                Text("mi")
                    .font(.vroomxBodyBold)
                    .foregroundColor(.textSecondary)
            }
        }
        .padding(16)
        .background(Color.cardBackground)
        .cornerRadius(12)
    }

    // MARK: - Interior Condition Section

    private var interiorConditionSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Interior Condition", systemImage: "car.interior")
                .font(.vroomxBodyBold)
                .foregroundColor(.textPrimary)

            // Grid of condition options
            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 10) {
                ForEach(InteriorCondition.allCases) { condition in
                    Button {
                        interiorCondition = condition
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: condition.icon)
                                .foregroundColor(interiorCondition == condition ? .white : condition.color)
                            Text(condition.rawValue)
                                .font(.vroomxBodyBold)
                                .foregroundColor(interiorCondition == condition ? .white : .textPrimary)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(
                            interiorCondition == condition
                                ? condition.color
                                : condition.color.opacity(0.1)
                        )
                        .cornerRadius(10)
                    }
                }
            }
        }
        .padding(16)
        .background(Color.cardBackground)
        .cornerRadius(12)
    }

    // MARK: - Notes Section

    private var notesSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Additional Notes", systemImage: "note.text")
                .font(.vroomxBodyBold)
                .foregroundColor(.textPrimary)

            TextEditor(text: $notes)
                .font(.vroomxBody)
                .frame(minHeight: 100)
                .padding(8)
                .background(Color.cardBackground)
                .cornerRadius(10)
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(Color.textSecondary.opacity(0.2), lineWidth: 1)
                )
                .overlay(alignment: .topLeading) {
                    if notes.isEmpty {
                        Text("Note any scratches, dents, mechanical issues, or other observations...")
                            .font(.vroomxBody)
                            .foregroundColor(.textSecondary.opacity(0.5))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 16)
                            .allowsHitTesting(false)
                    }
                }

            Text("\(notes.count) characters")
                .font(.vroomxCaptionSmall)
                .foregroundColor(.textSecondary)
        }
        .padding(16)
        .background(Color.cardBackground)
        .cornerRadius(12)
    }

    // MARK: - Location Section

    private var locationSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("GPS Location", systemImage: "location.fill")
                    .font(.vroomxBodyBold)
                    .foregroundColor(.textPrimary)

                Spacer()

                if locationManager.isCapturing {
                    ProgressView()
                        .scaleEffect(0.8)
                    Text("Capturing...")
                        .font(.vroomxCaption)
                        .foregroundColor(.textSecondary)
                } else if gpsLatitude != nil {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.brandSuccess)
                    Text("Captured")
                        .font(.vroomxCaption)
                        .foregroundColor(.brandSuccess)
                }
            }

            if let lat = gpsLatitude, let lng = gpsLongitude {
                // Location captured card
                VStack(alignment: .leading, spacing: 8) {
                    if let address = gpsAddress {
                        HStack(spacing: 8) {
                            Image(systemName: "mappin.circle.fill")
                                .foregroundColor(.brandPrimary)
                            Text(address)
                                .font(.vroomxBody)
                                .foregroundColor(.textPrimary)
                                .lineLimit(2)
                        }
                    }

                    HStack(spacing: 16) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Latitude")
                                .font(.vroomxCaptionSmall)
                                .foregroundColor(.textSecondary)
                            Text(String(format: "%.6f", lat))
                                .font(.vroomxMono)
                                .foregroundColor(.textPrimary)
                        }

                        VStack(alignment: .leading, spacing: 2) {
                            Text("Longitude")
                                .font(.vroomxCaptionSmall)
                                .foregroundColor(.textSecondary)
                            Text(String(format: "%.6f", lng))
                                .font(.vroomxMono)
                                .foregroundColor(.textPrimary)
                        }
                    }

                    if let capturedAt = locationManager.capturedAt {
                        HStack(spacing: 4) {
                            Image(systemName: "clock")
                                .font(.vroomxCaptionSmall)
                                .foregroundColor(.textSecondary)
                            Text(capturedAt, style: .date)
                                .font(.vroomxCaption)
                                .foregroundColor(.textSecondary)
                            Text(capturedAt, style: .time)
                                .font(.vroomxCaption)
                                .foregroundColor(.textSecondary)
                        }
                    }
                }
                .padding(12)
                .background(Color.brandPrimary.opacity(0.05))
                .cornerRadius(10)
            } else if let error = locationManager.errorMessage {
                // Error state
                HStack(spacing: 8) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(.brandWarning)
                    Text(error)
                        .font(.vroomxCaption)
                        .foregroundColor(.brandWarning)
                }
                .padding(12)
                .background(Color.brandWarning.opacity(0.05))
                .cornerRadius(10)

                Button {
                    locationManager.requestLocation()
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "arrow.clockwise")
                        Text("Retry")
                    }
                    .font(.vroomxBodyBold)
                    .foregroundColor(.brandPrimary)
                }
            } else if !locationManager.isCapturing {
                // Not yet captured
                Button {
                    locationManager.requestLocation()
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "location.fill")
                        Text("Capture Location")
                    }
                    .font(.vroomxBodyBold)
                    .foregroundColor(.brandPrimary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Color.brandPrimary.opacity(0.1))
                    .cornerRadius(10)
                }
            }
        }
        .padding(16)
        .background(Color.cardBackground)
        .cornerRadius(12)
    }
}

// MARK: - Preview

#Preview {
    struct PreviewWrapper: View {
        @State private var odometer = ""
        @State private var condition: InteriorCondition = .good
        @State private var notes = ""
        @State private var lat: Double? = 32.7767
        @State private var lng: Double? = -96.7970
        @State private var address: String? = "123 Main St Dallas TX 75201"

        var body: some View {
            NavigationStack {
                InspectionNotesView(
                    odometerReading: $odometer,
                    interiorCondition: $condition,
                    notes: $notes,
                    gpsLatitude: $lat,
                    gpsLongitude: $lng,
                    gpsAddress: $address
                )
                .navigationTitle("Notes & Conditions")
            }
        }
    }

    return PreviewWrapper()
}
