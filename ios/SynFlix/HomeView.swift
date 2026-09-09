import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var theme: ThemeStore
    @EnvironmentObject private var library: LibraryStore
    @EnvironmentObject private var router: AppRouter

    @State private var feed: HomeFeed?
    @State private var errorMessage: String?
    @State private var isLoading = true

    var body: some View {
        GeometryReader { geometry in
            let width = geometry.size.width
            let isPad = UIDevice.current.userInterfaceIdiom == .pad
            let edge = isPad ? max(28, min(44, width * 0.032)) : 18
            let posterWidth = isPad
                ? min(170, max(138, (width - edge * 2 - 70) / 6))
                : 138
            let landscapeWidth = isPad
                ? min(300, max(236, (width - edge * 2 - 48) / 4))
                : 250
            let heroHeight = isPad
                ? min(560, max(440, width * 0.47))
                : 565

            ZStack {
                Color.black.ignoresSafeArea()

                if let feed {
                    ScrollView(showsIndicators: false) {
                        LazyVStack(spacing: isPad ? 24 : 20) {
                            if let hero = heroItem(from: feed) {
                                heroView(
                                    hero,
                                    width: width,
                                    height: heroHeight,
                                    edge: edge,
                                    isPad: isPad
                                )
                            }

                            MediaShelf(title: "Trending Now", items: feed.trending ?? [], cardWidth: posterWidth, edgePadding: edge)
                            MediaShelf(title: "Popular Movies", items: feed.popular_movies ?? [], landscape: true, cardWidth: landscapeWidth, edgePadding: edge)
                            MediaShelf(title: "Now Playing", items: feed.now_playing ?? [], cardWidth: posterWidth, edgePadding: edge)
                            MediaShelf(title: "Popular Series", items: feed.popular_tv ?? [], cardWidth: posterWidth, edgePadding: edge)
                            MediaShelf(title: "Top Rated Movies", items: feed.top_rated_movies ?? [], landscape: true, cardWidth: landscapeWidth, edgePadding: edge)
                            MediaShelf(title: "Coming Soon", items: feed.upcoming ?? [], cardWidth: posterWidth, edgePadding: edge)
                            MediaShelf(title: "Top Rated Series", items: feed.top_rated_tv ?? [], cardWidth: posterWidth, edgePadding: edge)

                            Spacer(minLength: isPad ? 54 : 96)
                        }
                    }
                    .refreshable { await load(force: true) }
                } else if isLoading {
                    NativeLoadingView(text: "Loading SynFlix")
                } else if let errorMessage {
                    ErrorPanel(title: "Couldn't load SynFlix", message: errorMessage) {
                        Task { await load(force: true) }
                    }
                    .padding(24)
                }
            }
        }
        .task { await load(force: false) }
    }

    @ViewBuilder
    private func heroView(
        _ item: MediaItem,
        width: CGFloat,
        height: CGFloat,
        edge: CGFloat,
        isPad: Bool
    ) -> some View {
        ZStack(alignment: .bottomLeading) {
            AsyncImage(url: item.backdropURL ?? item.posterURL) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .scaledToFill()
                default:
                    LinearGradient(
                        colors: [theme.accent.opacity(0.13), Color.black],
                        startPoint: .topTrailing,
                        endPoint: .bottomLeading
                    )
                }
            }
            .frame(width: width, height: height)
            .clipped()

            LinearGradient(
                colors: [
                    .black.opacity(0.30),
                    .black.opacity(0.04),
                    .black.opacity(0.24),
                    .black.opacity(0.82),
                    .black
                ],
                startPoint: .top,
                endPoint: .bottom
            )

            LinearGradient(
                colors: [.black.opacity(isPad ? 0.76 : 0.68), .clear],
                startPoint: .leading,
                endPoint: .trailing
            )

            VStack(alignment: .leading, spacing: isPad ? 12 : 11) {
                HStack(spacing: 7) {
                    SynFlixBrandMark(size: 17)
                    Text("FEATURED")
                        .font(.system(size: 9.5, weight: .bold))
                        .tracking(1.35)
                        .foregroundStyle(.white.opacity(0.58))
                }

                Text(item.displayTitle)
                    .font(.system(size: isPad ? min(48, max(40, width * 0.042)) : 36, weight: .heavy))
                    .tracking(isPad ? -1.45 : -1.1)
                    .foregroundStyle(.white)
                    .lineLimit(2)
                    .frame(maxWidth: isPad ? min(620, width * 0.50) : width * 0.78, alignment: .leading)

                HStack(spacing: 8) {
                    if !item.year.isEmpty { Text(item.year) }
                    if let vote = item.vote_average, vote > 0 {
                        Text("•")
                        Image(systemName: "star.fill")
                            .font(.system(size: 9.5, weight: .bold))
                            .foregroundStyle(theme.accent)
                        Text(String(format: "%.1f", vote))
                    }
                    Text("•")
                    Text(item.kind == "tv" ? "Series" : "Movie")
                }
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.white.opacity(0.66))

                if let overview = item.overview, !overview.isEmpty {
                    Text(overview)
                        .font(.system(size: isPad ? 14 : 13.5))
                        .foregroundStyle(.white.opacity(0.66))
                        .lineSpacing(2.5)
                        .lineLimit(isPad ? 3 : 2)
                        .frame(maxWidth: isPad ? min(570, width * 0.47) : width * 0.78, alignment: .leading)
                }

                HStack(spacing: 9) {
                    AccentActionButton(title: "Play", symbol: "play.fill", accent: theme.accent) {
                        theme.impact(.medium)
                        router.play(item)
                    }

                    GlassActionButton(title: "More Info", symbol: "info.circle", tint: theme.accent.opacity(0.035)) {
                        theme.impact()
                        router.open(item)
                    }

                    Button {
                        library.toggle(item, haptics: theme.hapticsEnabled)
                    } label: {
                        Image(systemName: library.contains(item) ? "checkmark" : "plus")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(width: 42, height: 42)
                    }
                    .buttonStyle(.plain)
                    .synflixCircleGlass(tint: theme.accent.opacity(0.035))
                    .accessibilityLabel(library.contains(item) ? "Remove from My List" : "Add to My List")
                }
            }
            .padding(.horizontal, edge)
            .padding(.bottom, isPad ? 34 : 28)
        }
        .frame(width: width, height: height)
        .clipped()
    }

    private func heroItem(from feed: HomeFeed) -> MediaItem? {
        let candidates = (feed.trending ?? []) + (feed.popular_movies ?? [])
        return candidates.first(where: { $0.backdrop_path != nil }) ?? candidates.first
    }

    private func load(force: Bool) async {
        if feed != nil && !force { return }
        await MainActor.run {
            isLoading = true
            errorMessage = nil
        }
        do {
            let result = try await SynFlixAPI.shared.home()
            await MainActor.run {
                feed = result
                isLoading = false
            }
        } catch {
            await MainActor.run {
                errorMessage = error.localizedDescription
                isLoading = false
            }
        }
    }
}
