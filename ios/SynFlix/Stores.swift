import SwiftUI
import UIKit

@MainActor
final class AppRouter: ObservableObject {
    @Published var selectedItem: MediaItem?
    @Published var rootPlayer: PlayerRequest?

    func open(_ item: MediaItem) {
        selectedItem = item
    }

    func play(_ item: MediaItem) {
        rootPlayer = PlayerRequest(
            media: item,
            season: item.kind == "tv" ? 1 : nil,
            episode: item.kind == "tv" ? 1 : nil
        )
    }
}

@MainActor
final class LibraryStore: ObservableObject {
    @Published private(set) var items: [MediaItem] = []
    private let key = "synflix.native.library.v1"

    init() {
        guard let data = UserDefaults.standard.data(forKey: key),
              let decoded = try? JSONDecoder().decode([MediaItem].self, from: data) else {
            return
        }
        items = decoded
    }

    func contains(_ item: MediaItem) -> Bool {
        items.contains(item)
    }

    func toggle(_ item: MediaItem, haptics: Bool = true) {
        if let index = items.firstIndex(of: item) {
            items.remove(at: index)
        } else {
            items.insert(item, at: 0)
        }
        persist()
        if haptics {
            UIImpactFeedbackGenerator(style: .soft).impactOccurred()
        }
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(items) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }
}

enum RootSection: String, CaseIterable, Identifiable {
    case home
    case search
    case library
    case settings

    var id: String { rawValue }

    var title: String {
        switch self {
        case .home: return "Home"
        case .search: return "Search"
        case .library: return "My List"
        case .settings: return "Settings"
        }
    }

    var symbol: String {
        switch self {
        case .home: return "house.fill"
        case .search: return "magnifyingglass"
        case .library: return "bookmark.fill"
        case .settings: return "slider.horizontal.3"
        }
    }

    var shortcut: KeyEquivalent {
        switch self {
        case .home: return "1"
        case .search: return "2"
        case .library: return "3"
        case .settings: return "4"
        }
    }
}
