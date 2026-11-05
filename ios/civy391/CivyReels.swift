import SwiftUI
import AVKit

// Public creator-posted short films, licensed for redistribution (CC / CC0 / public domain).
// PeerTube's SepiaSearch API provides metadata; playback stays on the origin video host.
struct CivyShortFilm: Identifiable, Hashable {
    let id: String
    let title: String
    let summary: String
    let creator: String
    let duration: Int
    let licence: String
    let page: URL
    let image: URL?

    var timeText: String { String(format: "%d:%02d", duration / 60, duration % 60) }

    static func parse(_ entry: [String: Any]) -> CivyShortFilm? {
        guard let title = entry["name"] as? String, !title.isEmpty,
              let text = entry["url"] as? String,
              let url = URL(string: text), url.scheme == "https", let host = url.host,
              let duration = entry["duration"] as? Int, (420...840).contains(duration),
              entry["nsfw"] as? Bool != true else { return nil }
        let metadata = entry["licence"] as? [String: Any]
        let licenceId = metadata?["id"] as? Int ?? entry["licence"] as? Int ?? 0
        // PeerTube: values 1-6 CC, 7 CC0, 8 no known copyright restrictions, 9 all rights reserved.
        guard (1...8).contains(licenceId) else { return nil }
        let licence = metadata?["label"] as? String ?? "Creative Commons"
        let unique = entry["uuid"] as? String ?? url.lastPathComponent
        guard !unique.isEmpty else { return nil }
        let imagePath = entry["thumbnailPath"] as? String ?? entry["previewPath"] as? String ?? ""
        let img: URL?
        if imagePath.hasPrefix("/") {
            img = URL(string: imagePath, relativeTo: URL(string: "https://\(host)"))?.absoluteURL
        } else if let remote = URL(string: imagePath), remote.scheme == "https" {
            img = remote
        } else { img = nil }
        let account = entry["account"] as? [String: Any]
        let creator = account?["displayName"] as? String ?? account?["name"] as? String ?? "Independent creator"
        let desc = entry["description"] as? String ??
            entry["truncatedDescription"] as? String ?? "An independent short film."
        return CivyShortFilm(id: "\(host):\(unique)", title: title,
                             summary: String(desc.prefix(360)), creator: creator,
                             duration: duration, licence: licence, page: url, image: img)
    }
}

@MainActor
final class CivyClipsCatalog: ObservableObject {
    @Published var films: [CivyShortFilm] = []
    @Published var loading = false
    @Published var error: String?
    func refresh() async {
        guard !loading else { return }
        loading = true
        error = nil
        defer { loading = false }
        var films: [CivyShortFilm] = []
        var seen = Set<String>()
        for term in ["short film", "animated short film", "mini documentary", "short comedy"] {
            if Task.isCancelled { break }
            var components = URLComponents(string: "https://sepiasearch.org/api/v1/search/videos")!
            components.queryItems = [
                URLQueryItem(name: "search", value: term),
                URLQueryItem(name: "durationMin", value: "420"),
                URLQueryItem(name: "durationMax", value: "840"),
                URLQueryItem(name: "nsfw", value: "false"),
                URLQueryItem(name: "count", value: "40"),
                URLQueryItem(name: "sort", value: "-publishedAt")
            ]
            guard let url = components.url else { continue }
            var request = URLRequest(url: url, cachePolicy: .returnCacheDataElseLoad,
                                     timeoutInterval: 14)
            request.setValue("application/json", forHTTPHeaderField: "Accept")
            do {
                let (data, response) = try await URLSession.shared.data(for: request)
                guard (response as? HTTPURLResponse)?.statusCode == 200,
                      let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                      let items = json["data"] as? [[String: Any]] else { continue }
                for item in items {
                    if let film = CivyShortFilm.parse(item), seen.insert(film.id).inserted {
                        films.append(film)
                    }
                }
            } catch { continue }
            if films.count > 36 { break }
        }
        self.films = Array(films.shuffled().prefix(48))
        if self.films.isEmpty {
            error = "No openly licensed short films are available right now. Try again later."
        }
    }
}

struct CivyClipsView: View {
    @StateObject private var catalog = CivyClipsCatalog()
    @State private var activeID: String?
    @Environment(\.scenePhase) private var scene

    var body: some View {
        GeometryReader { geo in
            ZStack {
                Color.black.ignoresSafeArea()
                if catalog.loading && catalog.films.isEmpty {
                    VStack(spacing: 12) {
                        ProgressView().tint(.white)
                        Text("Finding short films…").font(.headline)
                        Text("Independent films · 7–14 minutes")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                } else if catalog.films.isEmpty {
                    ContentUnavailableView {
                        Label("No Clips Available", systemImage: "film.stack")
                    } description: {
                        Text(catalog.error ?? "Connect to the internet to browse creator-published films.")
                    } actions: {
                        Button("Try Again") { Task { await catalog.refresh() } }
                            .buttonStyle(.borderedProminent).tint(Color.synAccent)
                    }
                } else {
                    ScrollView(.vertical) {
                        LazyVStack(spacing: 0) {
                            ForEach(catalog.films) { item in
                                CivyFilmPage(film: item,
                                    active: scene == .active && (activeID ?? catalog.films.first?.id) == item.id)
                                    .frame(width: geo.size.width, height: geo.size.height)
                                    .id(item.id)
                            }
                        }
                        .scrollTargetLayout()
                    }
                    .scrollPosition(id: $activeID)
                    .scrollTargetBehavior(.paging)
                    .scrollIndicators(.hidden)
                }
            }
        }
        .ignoresSafeArea(edges: .bottom)
        .task { if catalog.films.isEmpty { await catalog.refresh() } }
    }
}

private struct CivyFilmPage: View {
    let film: CivyShortFilm
    let active: Bool
    @State private var player: AVPlayer?
    @State private var loading = false
    @State private var message: String?
    @State private var muted = false

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .bottom) {
                AsyncImage(url: film.image) { phase in
                    if let image = phase.image { image.resizable().scaledToFill() }
                    else { Color(red: 0.18, green: 0.10, blue: 0.11) }
                }
                .frame(width: geo.size.width, height: geo.size.height)
                .clipped()
                if let player {
                    VideoPlayer(player: player)
                        .frame(width: geo.size.width, height: geo.size.height)
                }
                LinearGradient(stops: [
                    .init(color: .clear, location: 0),
                    .init(color: .black.opacity(0.05), location: 0.37),
                    .init(color: .black.opacity(0.65), location: 0.72),
                    .init(color: .black.opacity(0.95), location: 1)
                ], startPoint: .top, endPoint: .bottom)
                .allowsHitTesting(false)

                if player == nil {
                    Button {
                        Task { await play() }
                    } label: {
                        Image(systemName: "play.fill")
                            .font(.system(size: 29, weight: .medium))
                            .foregroundStyle(.white)
                            .frame(width: 74, height: 74)
                            .glassEffect(.regular.interactive(), in: Circle())
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .buttonStyle(.plain)
                    .accessibilityLabel("Play \(film.title)")
                }
                if loading {
                    ProgressView().tint(.white)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
                if let message {
                    VStack(spacing: 10) {
                        Text(message).multilineTextAlignment(.center)
                            .font(.system(size: 14, weight: .medium))
                        Link("Open on PeerTube", destination: film.page)
                            .font(.system(size: 14, weight: .semibold))
                    }
                    .padding(16)
                    .glassEffect(.regular, in: RoundedRectangle(cornerRadius: 18))
                    .padding(.bottom, 310)
                }
                HStack(alignment: .bottom, spacing: 14) {
                    VStack(alignment: .leading, spacing: 9) {
                        Text(film.title).font(.system(size: 26, weight: .bold)).lineLimit(2)
                        Text("\(film.timeText) · \(film.creator)")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(.white.opacity(0.9))
                        Text(film.summary).font(.system(size: 14))
                            .foregroundStyle(.white.opacity(0.84)).lineLimit(3)
                        Text("\(film.licence) · PeerTube")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(.white.opacity(0.65))
                    }.frame(maxWidth: .infinity, alignment: .leading)
                    VStack(spacing: 20) {
                        Button {
                            muted.toggle()
                            player?.isMuted = muted
                        } label: {
                            Image(systemName: muted ? "speaker.slash.fill" : "speaker.wave.2.fill")
                        }.accessibilityLabel(muted ? "Unmute" : "Mute")
                        ShareLink(item: film.page) { Image(systemName: "paperplane.fill") }
                        Link(destination: film.page) { Image(systemName: "arrow.up.right.square.fill") }
                    }
                    .font(.system(size: 21))
                    .frame(width: 54).padding(.vertical, 17)
                    .glassEffect(.regular, in: Capsule())
                }
                .padding(.horizontal, 20).padding(.bottom, 115)
            }
        }
        .task(id: active) { if !active { stop() } }
        .onDisappear { stop() }
    }
    private func stop() {
        player?.pause()
        player?.replaceCurrentItem(with: nil)
        player = nil
    }
    private func play() async {
        loading = true
        message = nil
        defer { loading = false }
        guard let host = film.page.host, let uuid = film.id.split(separator: ":").last,
              let url = URL(string: "https://\(host)/api/v1/videos/\(uuid)") else {
            message = "Invalid creator video URL."
            return
        }
        do {
            var request = URLRequest(url: url, timeoutInterval: 16)
            request.setValue("application/json", forHTTPHeaderField: "Accept")
            let (data, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200,
                  let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                message = "This creator's video host is unavailable."
                return
            }
            let hls = (json["streamingPlaylists"] as? [[String: Any]] ?? [])
                .compactMap { $0["playlistUrl"] as? String }.first
            let mp4 = (json["files"] as? [[String: Any]] ?? [])
                .compactMap { $0["fileUrl"] as? String }.first
            guard let text = hls ?? mp4, let stream = URL(string: text),
                  stream.scheme == "https" else {
                message = "This short film has no iPhone-compatible stream."
                return
            }
            if Task.isCancelled { return }
            let next = AVPlayer(url: stream)
            next.isMuted = muted
            player = next
            next.play()
        } catch {
            message = "Couldn't connect to this creator's video host."
        }
    }
}
