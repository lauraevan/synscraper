import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var theme: ThemeStore
    @EnvironmentObject private var library: LibraryStore
    @EnvironmentObject private var router: AppRouter
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    @State private var feed: HomeFeed?
    @State private var errorMessage: String?
    @State private var isLoading = true

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            if let feed {
                ScrollView(showsIndicators: false) {
                    LazyVStack(spacing: horizontalSizeClass == .regular ? 28 : 22) {
                        if let hero = heroItem(from: feed) {
                            heroView(hero)
                        }

                        MediaShelf(title: "Trending Now", items: feed.trending ?? [])
                        MediaShelf(title: "Popular Movies", items: feed.popular_movies ?? [], landscape: true)
                        MediaShelf(title: "Now Playing", items: feed.now_playing ?? [])
                        MediaShelf(title: "Series Everyone's Watching", items: feed.popular_tv ?? [])
                        MediaShelf(title: "Critically Acclaimed", items: feed.top_rated_movies ?? [], landscape: true)
                        MediaShelf(title: "Coming Soon", items: feed.upcoming ?? [])
                        MediaShelf(title: "Top Rated Series", items: feed.top_rated_tv ?? [])

                        Spacer(minLength: 104)
                    }
                }
                .refreshable { await load(force: true) }
            } else if isLoading {
                NativeLoadingView(text: "Curating SynFlix")
            } else if let errorMessage {
                ErrorPanel(title: "Couldn't load SynFlix", message: errorMessage) {
                    Task { await load(force: true) }
                }
                .padding(24)
            }
        }
        .task { await load(force: false) }
    }

    @ViewBuilder
    private func heroView(_ item: MediaItem) -> some View {
        ZStack(alignment: .bottomLeading) {
            AsyncImage(url: item.backdropURL ?? item.posterURL) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .scaledToFill()
                default:
                    LinearGradient(
                        colors: [theme.accent.opacity(0.16), Color.black],
                        startPoint: .topTrailing,
                        endPoint: .bottomLeading
                    )
                }
            }
            .frame(height: horizontalSizeClass == .regular ? 670 : 575)
            .clipped()

            LinearGradient(
                colors: [
                    Color.black.opacity(0.18),
                    Color.black.opacity(0.08),
                    Color.black.opacity(0.72),
                    Color.black
                ],
                startPoint: .top,
                endPoint: .bottom
            )

            LinearGradient(
                colors: [Color.black.opacity(0.74), .clear],
                startPoint: .leading,
                endPoint: .trailing
            )

            VStack(alignment: .leading, spacing: 13) {
                HStack(spacing: 7) {
                    SynFlixBrandMark(size: 19)
                    Text("FEATURED")
                        .font(.system(size: 10, weight: .bold))
                        .tracking(1.45)
                        .foregroundStyle(.white.opacity(0.62))
                }

                Text(item.displayTitle)
                    .font(.system(size: horizontalSizeClass == .regular ? 50 : 38, weight: .heavy))
                    .tracking(horizontalSizeClass == .regular ? -1.8 : -1.25)
                    .foregroundStyle(.white)
                    .lineLimit(2)
                    .frame(maxWidth: horizontalSizeClass == .regular ? 660 : 420, alignment: .leading)

                HStack(spacing: 8) {
                    if !item.year.isEmpty { Text(item.year) }
                    if let vote = item.vote_average, vote > 0 {
                        Text("•")
                        Image(systemName: "star.fill")
                            .font(.system(size: 10, weight: .bold))
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
                        .font(.system(size: 14.5, weight: .regular))
                        .foregroundStyle(.white.opacity(0.67))
                        .lineSpacing(2.5)
                        .lineLimit(horizontalSizeClass == .regular ? 3 : 2)
                        .frame(maxWidth: horizontalSizeClass == .regular ? 600 : 390, alignment: .leading)
                }

                HStack(spacing: 10) {
                    AccentActionButton(title: "Play", symbol: "play.fill", accent: theme.accent) {
                        theme.impact(.medium)
                        router.play(item)
                    }

                    GlassActionButton(title: "Details", symbol: "info.circle.fill", tint: theme.accent.opacity(0.07)) {
                        theme.impact()
                        router.open(item)
                    }

                    Button {
                        library.toggle(item, haptics: theme.hapticsEnabled)
                    } label: {
                        Image(systemName: library.contains(item) ? "checkmark" : "plus")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(width: 44, height: 44)
                    }
                    .buttonStyle(.plain)
                    .synflixCircleGlass(tint: theme.accent.opacity(0.06))
                    .accessibilityLabel(library.contains(item) ? "Remove from My List" : "Add to My List")
                }
            }
            .padding(.horizontal, horizontalSizeClass == .regular ? 28 : 18)
            .padding(.bottom, horizontalSizeClass == .regular ? 42 : 28)
        }
        .frame(height: horizontalSizeClass == .regular ? 670 : 575)
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
