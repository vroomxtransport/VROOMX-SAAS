import Foundation
import Network
import Combine

/// Monitors device network connectivity using `NWPathMonitor`.
/// Publishes connection state for offline indicators and sync decisions.
final class NetworkMonitor: ObservableObject {
    /// Whether the device currently has network connectivity.
    @Published var isConnected: Bool = true

    /// The current network path status.
    @Published var connectionType: NWInterface.InterfaceType?

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "com.vroomx.driver.networkmonitor")

    init() {
        monitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                self?.isConnected = path.status == .satisfied
                self?.connectionType = path.availableInterfaces.first?.type
            }
        }
        monitor.start(queue: queue)
    }

    deinit {
        monitor.cancel()
    }
}
