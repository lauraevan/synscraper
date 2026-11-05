import SwiftUI
import AVKit
import UniformTypeIdentifiers

struct CivyOfflineVideo: Codable, Identifiable, Hashable, Sendable {
    let id: UUID
    let title: String
    let filename: String
    let bytes: Int64
    let added: Date
    var url: URL { CivyOfflineStore.folder.appendingPathComponent(filename) }
    var size: String { ByteCountFormatter.string(fromByteCount: bytes, countStyle: .file) }
}

@MainActor
final class CivyOfflineStore: ObservableObject {
    @Published var videos: [CivyOfflineVideo] = []
    @Published var importing = false
    @Published var failure: String?
    nonisolated static var folder: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Offline Videos", isDirectory: true)
    }
    nonisolated private static var index: URL { folder.appendingPathComponent("index.json") }
    init() {
        if let data = try? Data(contentsOf: Self.index),
           let saved = try? JSONDecoder().decode([CivyOfflineVideo].self, from: data) {
            videos = saved.filter { FileManager.default.fileExists(atPath: $0.url.path) }
        }
    }
    func importFiles(_ urls: [URL]) async {
        importing = true
        defer { importing = false }
        for url in urls {
            do {
                let item = try await Task.detached(priority: .userInitiated) {
                    try Self.copy(url)
                }.value
                videos.insert(item, at: 0)
                persist()
            } catch { failure = error.localizedDescription }
        }
    }
    nonisolated private static func copy(_ url: URL) throws -> CivyOfflineVideo {
        let ext = url.pathExtension.lowercased()
        guard ["mp4", "mov", "m4v"].contains(ext) else {
            throw NSError(domain: "Civy", code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Import an MP4, MOV, or M4V video."])
        }
        let authorized = url.startAccessingSecurityScopedResource()
        defer { if authorized { url.stopAccessingSecurityScopedResource() } }
        let fm = FileManager.default
        try fm.createDirectory(at: folder, withIntermediateDirectories: true)
        let id = UUID()
        let dest = folder.appendingPathComponent("\(id.uuidString).\(ext)")
        try fm.copyItem(at: url, to: dest)
        let bytes = (try? fm.attributesOfItem(atPath: dest.path)[.size] as? NSNumber)?.int64Value ?? 0
        return CivyOfflineVideo(id: id,
            title: url.deletingPathExtension().lastPathComponent.replacingOccurrences(of: "_", with: " "),
            filename: dest.lastPathComponent, bytes: bytes, added: Date())
    }
    func delete(_ video: CivyOfflineVideo) {
        do {
            try FileManager.default.removeItem(at: video.url)
            videos.removeAll { $0.id == video.id }
            persist()
        } catch { failure = error.localizedDescription }
    }
    var total: String {
        ByteCountFormatter.string(fromByteCount: videos.reduce(0) { $0 + $1.bytes }, countStyle: .file)
    }
    private func persist() {
        do {
            try FileManager.default.createDirectory(at: Self.folder, withIntermediateDirectories: true)
            try JSONEncoder().encode(videos).write(to: Self.index, options: .atomic)
        } catch { failure = error.localizedDescription }
    }
}

struct CivyOfflineLibraryView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var store = CivyOfflineStore()
    @State private var importer = false
    @State private var playing: CivyOfflineVideo?
    var body: some View {
        NavigationStack {
            ZStack {
                Color.synBackground.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        HStack(spacing: 16) {
                            Image(systemName: "arrow.down.circle.fill")
                                .font(.system(size: 39))
                                .frame(width: 66, height: 66)
                                .glassEffect(.regular.tint(Color.synAccent.opacity(0.25)),
                                             in: RoundedRectangle(cornerRadius: 21))
                            VStack(alignment: .leading, spacing: 6) {
                                Text("Offline Cinema").font(.system(size: 25, weight: .bold))
                                Text("Your videos. No Wi-Fi required.")
                                    .font(.system(size: 14)).foregroundStyle(.secondary)
                            }
                        }
                        Text("\(store.videos.count) videos · \(store.total)")
                            .font(.system(size: 14)).foregroundStyle(.secondary)
                        Button { importer = true } label: {
                            Label(store.importing ? "Importing…" : "Import video from Files",
                                  systemImage: "square.and.arrow.down")
                                .font(.system(size: 17, weight: .semibold))
                                .frame(maxWidth: .infinity).frame(height: 54)
                        }
                        .disabled(store.importing)
                        .foregroundStyle(.white)
                        .glassEffect(.regular.tint(Color.synAccent.opacity(0.36)).interactive(), in: Capsule())
                        if store.importing { ProgressView("Saving to Civy…").tint(Color.synAccent) }
                        if store.videos.isEmpty {
                            VStack(spacing: 14) {
                                Image(systemName: "film.stack")
                                    .font(.system(size: 44, weight: .light))
                                    .foregroundStyle(Color.synAccent)
                                Text("Nothing downloaded yet").font(.title3.bold())
                                Text("Import an MP4, M4V, or MOV video you own or have permission to save. Civy stores a copy on this iPhone.")
                                    .font(.system(size: 15))
                                    .foregroundStyle(.secondary)
                                    .multilineTextAlignment(.center)
                            }
                            .padding(28).frame(maxWidth: .infinity)
                            .background(Color.synSurface, in: RoundedRectangle(cornerRadius: 22))
                        } else {
                            LazyVStack(spacing: 11) {
                                ForEach(store.videos) { video in
                                    Button { playing = video } label: {
                                        HStack(spacing: 12) {
                                            Image(systemName: "play.rectangle.fill")
                                                .font(.system(size: 32))
                                                .foregroundStyle(Color.synAccent)
                                                .frame(width: 68, height: 65)
                                                .background(.black.opacity(0.3), in: RoundedRectangle(cornerRadius: 12))
                                            VStack(alignment: .leading, spacing: 7) {
                                                Text(video.title).font(.system(size: 16, weight: .semibold)).lineLimit(2)
                                                Text("Saved on iPhone · \(video.size)")
                                                    .font(.system(size: 12)).foregroundStyle(.secondary)
                                            }
                                            Spacer(minLength: 0)
                                            Image(systemName: "play.circle.fill")
                                                .font(.system(size: 28))
                                        }
                                        .foregroundStyle(.white)
                                        .padding(10)
                                        .background(Color.synSurface, in: RoundedRectangle(cornerRadius: 17))
                                    }
                                    .buttonStyle(.plain)
                                    .contextMenu {
                                        Button("Play", systemImage: "play.fill") { playing = video }
                                        Button("Remove from iPhone", systemImage: "trash", role: .destructive) {
                                            store.delete(video)
                                        }
                                    }
                                }
                            }
                        }
                        Text("Locally imported videos play offline. Synscraper streams still require an internet connection. This feature does not bypass DRM.")
                            .font(.system(size: 13)).foregroundStyle(.secondary)
                        Spacer(minLength: 35)
                    }.padding(19)
                }
            }
            .navigationTitle("Offline Library")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Done") { dismiss() } } }
            .fileImporter(isPresented: $importer, allowedContentTypes: [.movie],
                          allowsMultipleSelection: true) { result in
                switch result {
                case .success(let urls): Task { await store.importFiles(urls) }
                case .failure(let error): store.failure = error.localizedDescription
                }
            }
            .fullScreenCover(item: $playing) { CivyLocalPlayer(video: $0) }
            .alert("Offline Library", isPresented: Binding(
                get: { store.failure != nil },
                set: { if !$0 { store.failure = nil } }
            )) {
                Button("OK") { store.failure = nil }
            } message: { Text(store.failure ?? "Unknown error") }
        }
    }
}

private struct CivyLocalPlayer: View {
    let video: CivyOfflineVideo
    @Environment(\.dismiss) private var dismiss
    @State private var player: AVPlayer?
    var body: some View {
        ZStack(alignment: .topLeading) {
            Color.black.ignoresSafeArea()
            VideoPlayer(player: player).ignoresSafeArea()
            Button {
                player?.pause()
                dismiss()
            } label: {
                Image(systemName: "xmark").font(.system(size: 16, weight: .semibold))
                    .frame(width: 44, height: 44).foregroundStyle(.white)
                    .glassEffect(.regular.interactive(), in: Circle())
            }.padding(20)
        }
        .onAppear {
            let p = AVPlayer(url: video.url)
            player = p
            p.play()
        }
        .onDisappear { player?.pause(); player = nil }
        .statusBarHidden(true)
    }
}
