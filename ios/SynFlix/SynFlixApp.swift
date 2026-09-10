import SwiftUI
import Foundation

@main
struct SynFlixApp: App {
    init() {
        // Keep enough artwork on disk for fast repeat launches without turning the
        // app into a multi-gigabyte cache. API JSON uses its own smaller cache.
        URLCache.shared = URLCache(
            memoryCapacity: 28 * 1024 * 1024,
            diskCapacity: 192 * 1024 * 1024,
            diskPath: "synflix-artwork-cache"
        )

        // The native client does not need browser cookies. Refuse and clear them so
        // metadata/artwork requests remain stateless by default.
        HTTPCookieStorage.shared.cookieAcceptPolicy = .never
        HTTPCookieStorage.shared.removeCookies(since: .distantPast)
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
