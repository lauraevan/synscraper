import SwiftUI

@main
struct SynFlixApp: App {
    init() {
        // Give the native wrapper a real persistent HTTP cache instead of treating
        // every launch like a cold website visit. WebKit keeps its own website data
        // store too, so this complements the service-worker cache.
        URLCache.shared = URLCache(
            memoryCapacity: 96 * 1024 * 1024,
            diskCapacity: 768 * 1024 * 1024,
            diskPath: "synflix-offline-cache"
        )
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
