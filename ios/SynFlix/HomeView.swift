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
            let isWide = width >= 700
            let isLandscape = width > height
            let edge = isWide ? max(24, min(42, width * 0.032)) : 18
            let posterSpacing: CGFloat = isWide ? 12 : 10
            let visiblePosters: CGFloat = isWide ? (isLandscape ? 6.2 : 4.7) : 2.72
            let posterWidth = isWide
                ? min(174, max(136, (width - edge * 2 - posterSpacing * (visiblePosters - 1)) / visiblePosters))
                : 136
            let landscapeSpacing: CGFloat = isWide ? 13 : 10
            let visibleLandscape: CGFloat = isWide ? (isLandscape ? 3.65 : 2.55) : 1.48
            let landscapeWidth = isWide
                ? min(306, max(224, (width - edge * 2 - landscapeSpacing * (visibleLandscape - 1)) / visibleLandscape))
                : 248
            let heroHeight: CGFloat = {
                if !isWide { return min(555, max(480, height * 0.60)) }
                if isLandscape { return min(455, max(360, height * 0.46)) }
                return min(485, max(405, height * 0.38))
            }()

            ZStack {
                Color(red: 0.012, green: 0.012, blue: 0.012)
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
                                    isWide: isWide,
                                    isLandscape: isLandscape
                                )
                            }

                            VStack(spacing: isWide ? 22 : 19) {
                                MediaShelf(title: "Trending Now", items: feed.trending ?? [], cardWidth: posterWidth, edgePadding: edge)
                                MediaShelf(title: "Popular Movies", items: feed.popular_movies ?? [], landscape: true, cardWidth: landscapeWidth, edgePadding: edge)
                                MediaShelf(title: "Now Playing", items: feed.now_playing ?? [], cardWidth: posterWidth, edgePadding: edge)
                                MediaShelf(title: "Popular Series", items: feed.popular_tv ?? [], cardWidth: posterWidth, edgePadding: edge)
                                MediaShelf(title: "Top Rated Movies", items: feed.top_rated_movies ?? [], landscape: true, cardWidth: landscapeWidth, edgePadding: edge)
                                MediaShelf(title: "Coming Soon", items: feed.upcoming ?? [], cardWidth: posterWidth, edgePadding: edge)
                                MediaShelf(title: "Top Rated Series", items: feed.top_rated_tv ?? [], cardWidth: posterWidth, edgePadding: edge)
                                Spacer(minLength: isWide ? 36 : 84)
                            }
                            .padding(.top, isWide ? 4 : 2)
                        }
                    }
                    .refreshable { await load(force: true) }
                } else if isLoading {
                    homeSkeleton(width: width, edge: edge, isWide: isWide, heroHeight: heroHeight)
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
        isWide: Bool,
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
                        colors: [theme.accent.opacity(0.07), Color(red: 0.025, green: 0.025, blue: 0.025)],
                        startPoint: .topTrailing,
                        endPoint: .bottomLeading
                    )
                }
            }
            .frame(width: width, height: height)
            .clipped()

            LinearGradient(
                stops: [
                    .init(color: .black.opacity(0.52), location: 0.0),
                    .init(color: .clear, location: 0.24),
                    .init(color: .clear, location: 0.52),
                    .init(color: .black.opacity(0.46), location: 0.76),
                    .init(color: Color(red: 0.012, green: 0.012, blue: 0.012), location: 1.0)
                ],
                startPoint: .top,
                endPoint: .bottom
            )

            LinearGradient(
                colors: [
                    .black.opacity(isWide ? 0.72 : 0.64),
                    .black.opacity(isWide ? 0.25 : 0.20),
                    .clear
                ],
                startPoint: .leading,
                endPoint: .trailing
            )

            VStack(alignment: .leading, spacing: isWide ? 9 : 8) {
                HStack(spacing: 7) {
                    if !item.year.isEmpty { Text(item.year) }
                    if !item.year.isEmpty { Text("•") }
                    Text(item.kind == "tv" ? "Series" : "Movie")
                    if let vote = item.vote_average, vote > 0 {
                        Text("•")
                        Image(systemName: "star.fill")
                            .font(.system(size: 8.5, weight: .bold))
                            .foregroundStyle(theme.accent)
                        Text(String(format: "%.1f", vote))
                    }
                }
                .font(.system(size: isWide ? 12 : 11.5, weight: .semibold))
                .foregroundStyle(.white.opacity(0.66))

                Text(item.displayTitle)
                    .font(.system(size: isWide ? (isLandscape ? 44 : 41) : 34, weight: .bold))
                    .tracking(isWide ? -1.25 : -0.95)
                    .foregroundStyle(.white)
                    .lineLimit(2)
                    .minimumScaleFactor(0.80)
                    .frame(maxWidth: isWide ? min(580, width * (isLandscape ? 0.50 : 0.67)) : width * 0.82, alignment: .leading)

                if let overview = item.overview, !overview.isEmpty {
                    Text(overview)
                        .font(.system(size: isWide ? 13.5 : 13, weight: .regular))
                        .foregroundStyle(.white.opacity(0.63))
                        .lineSpacing(2)
                        .lineLimit(2)
                        .frame(maxWidth: isWide ? min(560, width * (isLandscape ? 0.49 : 0.66)) : width * 0.82, alignment: .leading)
                }

                HStack(spacing: 8) {
                    AccentActionButton(title: "Play", symbol: "play.fill", accent: theme.accent) {
                        theme.impact(.medium)
                        router.play(item)
                    }

                    GlassActionButton(title: "Details", symbol: "info.circle", tint: Color.white.opacity(0.008)) {
                        theme.impact()
                        router.open(item)
                    }

                    Button {
                        library.toggle(item, haptics: theme.hapticsEnabled)
                    } label: {
                        Image(systemName: library.contains(item) ? "checkmark" : "plus")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(width: 40, height: 40)
                    }
                    .buttonStyle(.plain)
                    .synflixCircleGlass(tint: Color.white.opacity(0.008))
                    .accessibilityLabel(library.contains(item) ? "Remove from My List" : "Add to My List")
                }
                .padding(.top, 2)
            }
            .padding(.horizontal, edge)
            .padding(.bottom, isWide ? 25 : 23)
        }
        .frame(width: width, height: height)
        .clipped()
    }

    private func homeSkeleton(width: CGFloat, edge: CGFloat, isWide: Bool, heroHeight: CGFloat) -> some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: isWide ? 22 : 19) {
                LinearGradient(
                    colors: [theme.accent.opacity(0.05), Color.white.opacity(0.012), Color(red: 0.012, green: 0.012, blue: 0.012)],
                    startPoint: .topTrailing,
                    endPoint: .bottomLeading
                )
                .frame(width: width, height: heroHeight)
                .overlay(alignment: .bottomLeading) {
                    VStack(alignment: .leading, spacing: 9) {
                        RoundedRectangle(cornerRadius: 3).fill(.white.opacity(0.09)).frame(width: isWide ? 290 : 210, height: 24)
                        RoundedRectangle(cornerRadius: 3).fill(.white.opacity(0.05)).frame(width: isWide ? 410 : 270, height: 12)
                        HStack(spacing: 8) {
                            RoundedRectangle(cornerRadius: 8).fill(theme.accent.opacity(0.42)).frame(width: 88, height: 40)
                            RoundedRectangle(cornerRadius: 8).fill(.white.opacity(0.06)).frame(width: 106, height: 40)
                        }
                    }
                    .padding(.horizontal, edge)
                    .padding(.bottom, 26)
                }

                ForEach(0..<3, id: \.self) { _ in
                    VStack(alignment: .leading, spacing: 10) {
                        RoundedRectangle(cornerRadius: 3)
                            .fill(.white.opacity(0.07))
                            .frame(width: 140, height: 17)
                            .padding(.horizontal, edge)
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 11) {
                                ForEach(0..<7, id: \.self) { _ in
                                    RoundedRectangle(cornerRadius: 6)
                                        .fill(.white.opacity(0.026))
                                        .frame(width: isWide ? 154 : 136, height: isWide ? 231 : 204)
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
