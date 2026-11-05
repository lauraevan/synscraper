import SwiftUI
import CryptoKit
import UIKit

enum CivyArtworkStore {
    private static var folder: URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("CivyArtwork", isDirectory: true)
    }
    static func path(_ url: URL) -> URL {
        let sha = SHA256.hash(data: Data(url.absoluteString.utf8))
            .map { String(format: "%02x", $0) }.joined()
        return folder.appendingPathComponent(sha + ".img")
    }
    static func load(_ url: URL) async -> UIImage? {
        let destination = path(url)
        if let data = try? Data(contentsOf: destination), let image = UIImage(data: data) { return image }
        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode),
                  data.count < 5_000_000, let image = UIImage(data: data) else { return nil }
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            try data.write(to: destination, options: .atomic)
            return image
        } catch { return nil }
    }
    static func prefetch(_ urls: [URL]) async {
        for url in urls.prefix(30) {
            if Task.isCancelled { return }
            _ = await load(url)
        }
    }
}
struct CivyCachedArtwork: View {
    let url: URL?
    @State private var bitmap: UIImage?
    var body: some View {
        Group {
            if let bitmap {
                Image(uiImage: bitmap).resizable().scaledToFill()
            } else {
                LinearGradient(colors: [Color.synSurface, Color(red: 0.2, green: 0.06, blue: 0.08), .black],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
            }
        }
        .task(id: url) {
            bitmap = nil
            guard let url else { return }
            bitmap = await CivyArtworkStore.load(url)
        }
    }
}