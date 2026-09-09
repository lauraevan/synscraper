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
            let isPad = UIDevice.current.userInterfaceIdiom == .pad || width >= 700
            let isLandscape = width > height
            let edge = isPad ? max(28, min(46, width * 0.034)) : 18
            let posterSpacing: CGFloat = isPad ? 13 : 10
            let visiblePosters: CGFloat = isPad ? (isLandscape ? 7.0 : 5.2) : 2.72
            let posterWidth = isPad
                ? min(176, max(142, (width - edge * 2 - posterSpacing * (visiblePosters - 1)) / visiblePosters))
                : 136
            let landscapeSpacing: CGFloat = isPad ? 14 : 10
            let visibleLandscape: CGFloat = isPad ? (isLandscape ? 4.0 : 2.8) : 1.48
            let landscapeWidth = isPad
                ? min(314, max(232, (width - edge * 2 - landscapeSpacing * (visibleLandscape - 1)) / visibleLandscape))
                : 248
            let heroHeight: CGFloat = {
                if !isPad { return min(570, max(500, height * 0.62)) }
                if isLandscape { return min(520, max(420, height * 0.53)) }
                return min(520, max(450, height * 0.39))
            }()

            ZStack {
                Color(red: 0.018, green: 0.018, blue: 0.018)
                    .ignoresSafeArea()

                if let feed {
                    ScrollView(showsIndicators: false) {
                        LazyVStack(spacing: 0) {
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

                            VStack(spacing: isPad ? 25 : 21) {
                                MediaShelf(title: "Trending Now", items: feed.trending ?? [], cardWidth: posterWidth, edgePadding: edge)
                                MediaShelf(title: "Popular Movies", items: feed.popular_movies ?? [], landscape: true, cardWidth: landscapeWidth, edgePadding: edge)
                                MediaShelf(title: "Now Playing", items: feed.now_playing ?? [], cardWidth: posterWidth, edgePadding: edge)
                                MediaShelf(title: "Popular Series", items: feed.popular_tv ?? [], cardWidth: posterWidth, edgePadding: edge)
                                MediaShelf(title: "Top Rated Movies", items: feed.top_rated_movies ?? [], landscape: true, cardWidth: landscapeWidth, edgePadding: edge)
                                MediaShelf(title: "Coming Soon", items: feed.upcoming ?? [], cardWidth: posterWidth, edgePadding: edge)
                                MediaShelf(title: "Top Rated Series", items: feed.top_rated_tv ?? [], cardWidth: posterWidth, edgePadding: edge)

                                Spacer(minLength: isPad ? 110 : 104)
                            }
                            .padding(.top, isPad ? 8 : 4)
                        }
                    }
                    .refreshable { await load(force: true) }
                } else if isLoading {
                    homeSkeleton(width: width, edge: edge, isPad: isPad, heroHeight: heroHeight)
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
                        colors: [theme.accent.opacity(0.10), Color(red: 0.03, green: 0.03, blue: 0.03)],
                        startPoint: .topTrailing,
                        endPoint: .bottomLeading
                    )
                }
            }
            .frame(width: width, height: height)
            .clipped()

            LinearGradient(
                stops: [
                    .init(color: .black.opacity(0.56), location: 0.0),
                    .init(color: .clear, location: 0.23),
                    .init(color: .clear, location: 0.50),
                    .init(color: .black.opacity(0.42), location: 0.73),
                    .init(color: Color(red: 0.018, green: 0.018, blue: 0.018), location: 1.0)
                ],
                startPoint: .top,
                endPoint: .bottom
            )

            LinearGradient(
                colors: [
                    .black.opacity(isPad ? 0.74 : 0.65),
                    .black.opacity(isPad ? 0.30 : 0.22),
                    .clear
                ],
                startPoint: .leading,
                endPoint: .trailing
            )

            VStack(alignment: .leading, spacing: isPad ? 10 : 9) {
                HStack(spacing: 7) {
                    if !item.year.isEmpty {
                        Text(item.year)
                    }
                    if !item.year.isEmpty { Text("•") }
                    Text(item.kind == "tv" ? "Series" : "Movie")
                    if let vote = item.vote_average, vote > 0 {
                        Text("•")
                        Image(systemName: "star.fill")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(theme.accent)
                        Text(String(format: "%.1f", vote))
                    }
                }
                .font(.system(size: isPad ? 12.5 : 11.5, weight: .semibold))
                .foregroundStyle(.white.opacity(0.69))

                Text(item.displayTitle)
                    .font(.system(size: isPad ? (isLandscape ? 48 : 44) : 35, weight: .heavy))
                    .tracking(isPad ? -1.45 : -1.05)
                    .foregroundStyle(.white)
                    .lineLimit(2)
                    .minimumScaleFactor(0.78)
                    .frame(maxWidth: isPad ? min(620, width * (isLandscape ? 0.48 : 0.66)) : width * 0.82, alignment: .leading)

                if let overview = item.overview, !overview.isEmpty {
                    Text(overview)
                        .font(.system(size: isPad ? 14 : 13.25, weight: .regular))
                        .foregroundStyle(.white.opacity(0.66))
                        .lineSpacing(2.4)
                        .lineLimit(isPad ? 2 : 2)
                        .frame(maxWidth: isPad ? min(590, width * (isLandscape ? 0.46 : 0.64)) : width * 0.82, alignment: .leading)
                }

                HStack(spacing: 9) {
                    AccentActionButton(title: "Play", symbol: "play.fill", accent: theme.accent) {
                        theme.impact(.medium)
                        router.play(item)
                    }

                    GlassActionButton(title: "More Info", symbol: "info.circle", tint: Color.white.opacity(0.012)) {
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
                    .synflixCircleGlass(tint: Color.white.opacity(0.010))
                    .accessibilityLabel(library.contains(item) ? "Remove from My List" : "Add to My List")
                }
                .padding(.top, 2)
            }
            .padding(.horizontal, edge)
            .padding(.bottom, isPad ? 30 : 25)
        }
        .frame(width: width, height: height)
        .clipped()
    }

    private func homeSkeleton(width: CGFloat, edge: CGFloat, isPad: Bool, heroHeight: CGFloat) -> some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: isPad ? 24 : 20) {
                LinearGradient(
                    colors: [theme.accent.opacity(0.07), Color.white.opacity(0.014), Color(red: 0.018, green: 0.018, blue: 0.018)],
                    startPoint: .topTrailing,
                    endPoint: .bottomLeading
                )
                .frame(width: width, height: heroHeight)
                .overlay(alignment: .bottomLeading) {
                    VStack(alignment: .leading, spacing: 10) {
                        RoundedRectangle(cornerRadius: 4).fill(.white.opacity(0.10)).frame(width: isPad ? 320 : 220, height: 26)
                        RoundedRectangle(cornerRadius: 4).fill(.white.opacity(0.06)).frame(width: isPad ? 430 : 280, height: 13)
                        HStack(spacing: 9) {
                            RoundedRectangle(cornerRadius: 10).fill(theme.accent.opacity(0.48)).frame(width: 92, height: 42)
                            RoundedRectangle(cornerRadius: 10).fill(.white.opacity(0.07)).frame(width: 116, height: 42)
                        }
                    }
                    .padding(.horizontal, edge)
                    .padding(.bottom, 30)
                }

                ForEach(0..<3, id: \.self) { _ in
                    VStack(alignment: .leading, spacing: 11) {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(.white.opacity(0.08))
                            .frame(width: 150, height: 18)
                            .padding(.horizontal, edge)
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 12) {
                                ForEach(0..<7, id: \.self) { _ in
                                    RoundedRectangle(cornerRadius: 7)
                                        .fill(.white.opacity(0.03))
                                        .frame(width: isPad ? 160 : 136, height: isPad ? 240 : 204)
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
