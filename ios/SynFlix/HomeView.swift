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
            let height = geometry.size.height
            let isPad = UIDevice.current.userInterfaceIdiom == .pad
            let isLandscape = width > height
            let edge = isPad ? max(34, min(52, width * 0.036)) : 18
            let posterCount: CGFloat = isPad ? (isLandscape ? 7 : 5) : 2.65
            let posterSpacing: CGFloat = isPad ? 14 : 11
            let posterWidth = isPad
                ? min(184, max(146, (width - edge * 2 - posterSpacing * (posterCount - 1)) / posterCount))
                : 138
            let landscapeCount: CGFloat = isPad ? (isLandscape ? 4 : 3) : 1.5
            let landscapeSpacing: CGFloat = isPad ? 16 : 11
            let landscapeWidth = isPad
                ? min(318, max(242, (width - edge * 2 - landscapeSpacing * (landscapeCount - 1)) / landscapeCount))
                : 250
            let heroHeight: CGFloat = {
                guard isPad else { return 565 }
                if isLandscape {
                    return min(590, max(480, height * 0.69))
                }
                return min(575, max(500, height * 0.48))
            }()

            ZStack {
                Color.black.ignoresSafeArea()

                if let feed {
                    ScrollView(showsIndicators: false) {
                        LazyVStack(spacing: isPad ? 28 : 20) {
                            if let hero = heroItem(from: feed) {
                                heroView(
                                    hero,
                                    width: width,
                                    height: heroHeight,
                                    edge: edge,
                                    isPad: isPad,
                                    isLandscape: isLandscape
                                )
                            }

                            MediaShelf(title: "Trending Now", items: feed.trending ?? [], cardWidth: posterWidth, edgePadding: edge)
                            MediaShelf(title: "Popular Movies", items: feed.popular_movies ?? [], landscape: true, cardWidth: landscapeWidth, edgePadding: edge)
                            MediaShelf(title: "Now Playing", items: feed.now_playing ?? [], cardWidth: posterWidth, edgePadding: edge)
                            MediaShelf(title: "Popular Series", items: feed.popular_tv ?? [], cardWidth: posterWidth, edgePadding: edge)
                            MediaShelf(title: "Top Rated Movies", items: feed.top_rated_movies ?? [], landscape: true, cardWidth: landscapeWidth, edgePadding: edge)
                            MediaShelf(title: "Coming Soon", items: feed.upcoming ?? [], cardWidth: posterWidth, edgePadding: edge)
                            MediaShelf(title: "Top Rated Series", items: feed.top_rated_tv ?? [], cardWidth: posterWidth, edgePadding: edge)

                            Spacer(minLength: isPad ? 48 : 96)
                        }
                    }
                    .refreshable { await load(force: true) }
                } else if isLoading {
                    homeSkeleton(width: width, edge: edge, isPad: isPad)
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
        isPad: Bool,
        isLandscape: Bool
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
                        colors: [theme.accent.opacity(0.12), Color.black],
                        startPoint: .topTrailing,
                        endPoint: .bottomLeading
                    )
                }
            }
            .frame(width: width, height: height)
            .clipped()

            LinearGradient(
                colors: [
                    .black.opacity(0.16),
                    .black.opacity(0.02),
                    .black.opacity(0.18),
                    .black.opacity(0.78),
                    .black
                ],
                startPoint: .top,
                endPoint: .bottom
            )

            LinearGradient(
                colors: [.black.opacity(isPad ? 0.82 : 0.70), .black.opacity(0.15), .clear],
                startPoint: .leading,
                endPoint: .trailing
            )

            VStack(alignment: .leading, spacing: isPad ? 12 : 11) {
                HStack(spacing: 7) {
                    SynFlixBrandMark(size: isPad ? 18 : 17)
                    Text("FEATURED")
                        .font(.system(size: 9.5, weight: .bold))
                        .tracking(1.35)
                        .foregroundStyle(.white.opacity(0.56))
                }

                Text(item.displayTitle)
                    .font(.system(size: isPad ? (isLandscape ? 52 : 46) : 36, weight: .heavy))
                    .tracking(isPad ? -1.5 : -1.1)
                    .foregroundStyle(.white)
                    .lineLimit(2)
                    .minimumScaleFactor(0.82)
                    .frame(maxWidth: isPad ? min(690, width * (isLandscape ? 0.50 : 0.64)) : width * 0.80, alignment: .leading)

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
                .font(.system(size: isPad ? 12.5 : 12, weight: .semibold))
                .foregroundStyle(.white.opacity(0.66))

                if let overview = item.overview, !overview.isEmpty {
                    Text(overview)
                        .font(.system(size: isPad ? 14.5 : 13.5))
                        .foregroundStyle(.white.opacity(0.67))
                        .lineSpacing(2.7)
                        .lineLimit(isPad ? 3 : 2)
                        .frame(maxWidth: isPad ? min(620, width * (isLandscape ? 0.46 : 0.62)) : width * 0.80, alignment: .leading)
                }

                HStack(spacing: 9) {
                    AccentActionButton(title: "Play", symbol: "play.fill", accent: theme.accent) {
                        theme.impact(.medium)
                        router.play(item)
                    }

                    GlassActionButton(title: "More Info", symbol: "info.circle", tint: theme.accent.opacity(0.026)) {
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
                    .synflixCircleGlass(tint: theme.accent.opacity(0.028))
                    .accessibilityLabel(library.contains(item) ? "Remove from My List" : "Add to My List")
                }
            }
            .padding(.horizontal, edge)
            .padding(.bottom, isPad ? 38 : 28)
        }
        .frame(width: width, height: height)
        .clipped()
    }

    private func homeSkeleton(width: CGFloat, edge: CGFloat, isPad: Bool) -> some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: isPad ? 30 : 24) {
                LinearGradient(
                    colors: [theme.accent.opacity(0.08), Color.white.opacity(0.018), .black],
                    startPoint: .topTrailing,
                    endPoint: .bottomLeading
                )
                .frame(height: isPad ? 520 : 500)
                .overlay(alignment: .bottomLeading) {
                    VStack(alignment: .leading, spacing: 12) {
                        RoundedRectangle(cornerRadius: 5).fill(.white.opacity(0.10)).frame(width: isPad ? 340 : 220, height: 28)
                        RoundedRectangle(cornerRadius: 4).fill(.white.opacity(0.07)).frame(width: isPad ? 420 : 280, height: 14)
                        HStack(spacing: 10) {
                            RoundedRectangle(cornerRadius: 9).fill(theme.accent.opacity(0.55)).frame(width: 96, height: 42)
                            RoundedRectangle(cornerRadius: 9).fill(.white.opacity(0.08)).frame(width: 120, height: 42)
                        }
                    }
                    .padding(.horizontal, edge)
                    .padding(.bottom, 40)
                }

                ForEach(0..<3, id: \.self) { _ in
                    VStack(alignment: .leading, spacing: 12) {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(.white.opacity(0.08))
                            .frame(width: 150, height: 18)
                            .padding(.horizontal, edge)
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 13) {
                                ForEach(0..<7, id: \.self) { _ in
                                    RoundedRectangle(cornerRadius: 8)
                                        .fill(.white.opacity(0.035))
                                        .frame(width: isPad ? 166 : 138, height: isPad ? 249 : 207)
                                }
                            }
                            .padding(.horizontal, edge)
                        }
                    }
                }
            }
        }
        .redacted(reason: .placeholder)
        .allowsHitTesting(false)
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
