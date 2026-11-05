import SwiftUI
import AVKit
import SafariServices

// Native short-video feed and official trailers from Civy's own title catalog.
struct CivyClipsView: View {
    @State private var mode: CivyClipMode = .trailers

    var body: some View {
        ZStack(alignment: .top) {
            Group {
                switch mode {
                case .trailers: CivyTrailerClipsView()
                case .shorts: CivyShortClipsView()
                }
            }
            .id(mode)
            VStack(spacing: 0) {
                HStack(spacing: 12) {
                    Text("Clips")
                        .font(.system(size: 27, weight: .bold))
                        .foregroundStyle(.white)
                    Spacer()
                    Picker("Clip source", selection: $mode) {
                        Text("Trailers").tag(CivyClipMode.trailers)
                        Text("Shorts").tag(CivyClipMode.shorts)
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 184)
                    .tint(Color.synAccent)
                    .accessibilityIdentifier("civy.clips.mode")
                }
                .padding(.horizontal, 19)
                .padding(.top, 12)
                .padding(.bottom, 14)
                .background {
                    LinearGradient(colors: [.black.opacity(0.85), .black.opacity(0.45), .clear],
                                   startPoint: .top, endPoint: .bottom)
                        .ignoresSafeArea(edges: .top)
                }
                Spacer(minLength: 0)
            }
        }
        .background(.black)
        .accessibilityIdentifier("civy.clips.workingFeed")
    }
}

private enum CivyClipMode: Hashable {
    case trailers, shorts
}


// Immersive clips using official TMDB-listed trailers. No fabricated video feeds.
struct CivyTrailerClipsView: View {
    @EnvironmentObject private var app: AppState
    @State private var activeID: String?
    @State private var selected: Media?

    private var clips: [Media] {
        guard let home = app.home else { return [] }
        var keys = Set<String>()
        return (home.trending + home.popularTv + home.nowPlaying + home.popularMovies)
            .filter { ($0.backdropPath != nil || $0.posterPath != nil) && keys.insert($0.key).inserted }
            .prefix(30).map { $0 }
    }

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                Color.black.ignoresSafeArea()
                if clips.isEmpty {
                    VStack(spacing: 15) {
                        ProgressView().tint(Color.synAccent)
                        Text("Finding trailers…").font(.system(size: 16, weight: .medium))
                    }
                } else {
                    ScrollView(.vertical) {
                        LazyVStack(spacing: 0) {
                            ForEach(clips) { media in
                                CivyClipPage(media: media,
                                             isActive: activeID == nil ? media.key == clips.first?.key : activeID == media.key,
                                             onDetails: { selected = media })
                                    .frame(width: geometry.size.width, height: geometry.size.height)
                                    .id(media.key)
                            }
                        }
                        .scrollTargetLayout()
                    }
                    .scrollTargetBehavior(.paging)
                    .scrollPosition(id: $activeID)
                    .scrollIndicators(.hidden)
                }
            }
        }
        .ignoresSafeArea(edges: .bottom)
        .sheet(item: $selected) { DetailView(media: $0).environmentObject(app) }
        .task { if app.home == nil { await app.loadHome() } }
    }
}

private struct CivyClipPage: View {
    @EnvironmentObject private var app: AppState
    let media: Media
    let isActive: Bool
    let onDetails: () -> Void
    @State private var details: MediaDetails?
    @State private var trailer: TMDBVideo?
    @State private var showingTrailer = false

    private var trailerKey: String? {
        guard let trailer, trailer.site.lowercased() == "youtube",
              trailer.key.range(of: "^[A-Za-z0-9_-]{8,24}$", options: .regularExpression) != nil else { return nil }
        return trailer.key
    }
    private var description: String {
        let value = media.overview?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return value.isEmpty ? "Discover \(media.displayTitle) on Civy." : value
    }
    private var artURL: URL? { TMDBImage.url(media.backdropPath ?? media.posterPath, size: "w780") }
    private var shareURL: URL? { URL(string: "https://www.themoviedb.org/\(media.kind)/\(media.id)") }

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .bottom) {
                AsyncImage(url: artURL) { phase in
                    if let image = phase.image { image.resizable().scaledToFill() }
                    else { Color.synSurface }
                }
                .frame(width: proxy.size.width, height: proxy.size.height)
                .clipped()

                LinearGradient(stops: [
                    .init(color: .clear, location: 0),
                    .init(color: .black.opacity(0.0), location: 0.38),
                    .init(color: .black.opacity(0.38), location: 0.57),
                    .init(color: .black.opacity(0.90), location: 0.95),
                    .init(color: .black.opacity(0.94), location: 1)
                ], startPoint: .top, endPoint: .bottom)
                .allowsHitTesting(false)

                if trailerKey != nil {
                    Button {
                        showingTrailer = true
                    } label: {
                        Image(systemName: "play.fill")
                            .font(.system(size: 27))
                            .foregroundStyle(.white)
                            .frame(width: 68, height: 68)
                            .background(.black.opacity(0.43), in: Circle())
                            .overlay(Circle().strokeBorder(.white.opacity(0.50)))
                    }
                    .buttonStyle(.plain)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .accessibilityLabel("Play official trailer")
                }

                HStack(alignment: .bottom, spacing: 12) {
                    VStack(alignment: .leading, spacing: 12) {
                        if let logo = details?.heroLogo {
                            AsyncImage(url: logo) { image in
                                image.resizable().scaledToFit()
                            } placeholder: {
                                Text(media.displayTitle)
                                    .font(.system(size: 26, weight: .black))
                                    .multilineTextAlignment(.leading)
                            }
                            .frame(maxWidth: 190, maxHeight: 78, alignment: .leading)
                        } else {
                            Text(media.displayTitle)
                                .font(.system(size: 26, weight: .black))
                                .tracking(-0.7)
                                .fixedSize(horizontal: false, vertical: true)
                                .lineLimit(2)
                        }
                        Text("\(media.kind == "tv" ? "Series" : "Film")  ·  \(media.genreLabel.split(separator: " · ").first.map(String.init) ?? "Featured")")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(.white.opacity(0.87))
                        Text(description)
                            .font(.system(size: 14))
                            .foregroundStyle(.white.opacity(0.88))
                            .lineLimit(3)
                            .fixedSize(horizontal: false, vertical: true)
                        HStack(spacing: 8) {
                            Capsule().fill(.white.opacity(0.75)).frame(width: 18, height: 5)
                            Capsule().fill(.white.opacity(0.28)).frame(height: 5)
                            Text(trailerKey == nil ? "Trailer unavailable" : "Official trailer")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(.white.opacity(0.75))
                        }
                        .padding(.top, 4)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    VStack(spacing: 20) {
                        Button { showingTrailer = true } label: {
                            reelButton("play.rectangle.fill")
                        }
                        .disabled(trailerKey == nil)
                        .accessibilityLabel("Watch trailer")
                        Button { app.toggleFavorite(media) } label: {
                            reelButton(app.isFavorite(media) ? "checkmark" : "plus")
                        }
                        .accessibilityLabel(app.isFavorite(media) ? "Remove from My List" : "Add to My List")
                        if let shareURL {
                            ShareLink(item: shareURL) { reelButton("paperplane") }
                                .accessibilityLabel("Share \(media.displayTitle)")
                        }
                        Button(action: onDetails) {
                            AsyncImage(url: media.posterURL) { phase in
                                if let image = phase.image { image.resizable().scaledToFill() }
                                else { Image(systemName: "film.stack.fill") }
                            }
                            .frame(width: 49, height: 49)
                            .clipShape(Circle())
                            .overlay(Circle().strokeBorder(.white.opacity(0.9), lineWidth: 2))
                        }
                        .accessibilityLabel("View details")
                    }
                    .buttonStyle(.plain)
                    .frame(width: 53)
                }
                .padding(.leading, 18)
                .padding(.trailing, 13)
                .padding(.bottom, 120) // Above the floating Liquid Glass tab bar
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
        }
        .background(.black)
        .task(id: media.key) {
            details = try? await app.api.details(media)
            trailer = details?.videos?.results.first(where: {
                $0.site.lowercased() == "youtube" && ($0.type == "Trailer" || $0.type == "Teaser")
            })
        }
        .sheet(isPresented: $showingTrailer) {
            if let trailerKey,
               let url = URL(string: "https://www.youtube.com/watch?v=\(trailerKey)") {
                CivyTrailerSafari(url: url).ignoresSafeArea()
            }
        }
    }
    private func reelButton(_ icon: String) -> some View {
        Image(systemName: icon)
            .font(.system(size: 24, weight: .regular))
            .foregroundStyle(.white)
            .frame(width: 51, height: 51)
            .background(.black.opacity(0.39), in: Circle())
            .overlay(Circle().strokeBorder(.white.opacity(0.18)))
    }
}

// Official YouTube playback stays inside Civy using Safari's supported origin.
// The standalone YouTube WKWebView embed could fail on iOS with error 153.
private struct CivyTrailerSafari: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context: Context) -> SFSafariViewController {
        let controller = SFSafariViewController(url: url)
        controller.dismissButtonStyle = .done
        controller.preferredControlTintColor = UIColor.systemPink
        return controller
    }
    func updateUIViewController(_ view: SFSafariViewController, context: Context) {}
}


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
              let duration = entry["duration"] as? Int, (20...420).contains(duration),
              entry["nsfw"] as? Bool != true else { return nil }
        let metadata = entry["licence"] as? [String: Any]
        let licenceId = metadata?["id"] as? Int ?? entry["licence"] as? Int ?? 0
        // PeerTube: values 1-6 CC, 7 CC0, 8 no known copyright restrictions, 9 all rights reserved.
        let licence = metadata?["label"] as? String ?? "Creator video"
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
        for term in ["short film", "animation", "short comedy", "video clip"] {
            if Task.isCancelled { break }
            var components = URLComponents(string: "https://sepiasearch.org/api/v1/search/videos")!
            components.queryItems = [
                URLQueryItem(name: "search", value: term),
                URLQueryItem(name: "durationMin", value: "20"),
                URLQueryItem(name: "durationMax", value: "420"),
                URLQueryItem(name: "nsfw", value: "false"),
                URLQueryItem(name: "count", value: "40"),
                URLQueryItem(name: "sort", value: "-match")
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
            error = "Could not find creator clips right now. Try again, or browse trailers."
        }
    }
}

struct CivyShortClipsView: View {
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
                        Text("Finding creator clips…").font(.headline)
                        Text("Creator videos · under 7 minutes")
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
        .task(id: active) {
            if active { await play() } else { stop() }
        }
        .onDisappear { stop() }
    }
    private func stop() {
        player?.pause()
        player?.replaceCurrentItem(with: nil)
        player = nil
    }
    private func play() async {
        guard player == nil && !loading && active else { return }
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
            let mp4 = ((json["files"] as? [[String: Any]] ?? []) + (json["webVideoFiles"] as? [[String: Any]] ?? []))
                .compactMap { $0["fileUrl"] as? String }.first
            guard let text = hls ?? mp4, let stream = URL(string: text),
                  stream.scheme == "https" else {
                message = "This short film has no iPhone-compatible stream."
                return
            }
            if Task.isCancelled || !active { return }
            let next = AVPlayer(url: stream)
            next.isMuted = muted
            player = next
            next.play()
        } catch {
            message = "Couldn't connect to this creator's video host."
        }
    }
}
