import SwiftUI
import WebKit

// Immersive clips using official TMDB-listed trailers. No fabricated video feeds.
struct CivyClipsView: View {
    @EnvironmentObject private var app: AppState
    @State private var activeID: String?
    @State private var selected: Media?

    private var clips: [Media] {
        guard let home = app.home else { return [] }
        var keys = Set<String>()
        return (home.trending + home.popularTv + home.nowPlaying + home.popularMovies)
            .filter { ($0.backdropPath != nil || $0.posterPath != nil) && keys.insert($0.key).inserted }
            .prefix(15).map { $0 }
    }

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                Color.black.ignoresSafeArea()
                if clips.isEmpty {
                    VStack(spacing: 15) {
                        ProgressView().tint(Color.synAccent)
                        Text("Loading clips…").font(.system(size: 16, weight: .medium))
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
    @State private var playingTrailer = false
    @State private var muted = true

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

                if playingTrailer, let trailerKey {
                    CivyOfficialTrailer(key: trailerKey, muted: muted)
                        .frame(width: proxy.size.width, height: proxy.size.height)
                        .transition(.opacity)
                }

                LinearGradient(stops: [
                    .init(color: .clear, location: 0),
                    .init(color: .black.opacity(0.0), location: 0.38),
                    .init(color: .black.opacity(0.38), location: 0.57),
                    .init(color: .black.opacity(0.90), location: 0.95),
                    .init(color: .black.opacity(0.94), location: 1)
                ], startPoint: .top, endPoint: .bottom)
                .allowsHitTesting(false)

                if !playingTrailer, trailerKey != nil {
                    Button {
                        withAnimation(.easeOut(duration: 0.22)) { playingTrailer = true }
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
                            Text(trailerKey == nil ? "Preview" : "Official trailer")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(.white.opacity(0.75))
                        }
                        .padding(.top, 4)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    VStack(spacing: 20) {
                        Button {
                            muted.toggle()
                            if playingTrailer { playingTrailer = false }
                        } label: {
                            reelButton(muted ? "speaker.slash" : "speaker.wave.2")
                        }
                        .accessibilityLabel(muted ? "Unmute trailer" : "Mute trailer")
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
        .onChange(of: isActive) { _, active in
            if !active { playingTrailer = false }
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

// An official YouTube trailer is loaded only after the viewer taps Play.
// TMDB provides trailer metadata, not downloadable movie or clip files.
private struct CivyOfficialTrailer: UIViewRepresentable {
    let key: String
    let muted: Bool
    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.isOpaque = false
        view.backgroundColor = .black
        view.scrollView.isScrollEnabled = false
        view.allowsBackForwardNavigationGestures = false
        return view
    }
    func updateUIView(_ view: WKWebView, context: Context) {
        guard view.url == nil else { return }
        let mutedParam = muted ? "1" : "0"
        guard let url = URL(string: "https://www.youtube-nocookie.com/embed/\(key)?autoplay=1&playsinline=1&controls=1&modestbranding=1&mute=\(mutedParam)") else { return }
        view.load(URLRequest(url: url))
    }
}