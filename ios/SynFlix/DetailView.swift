import SwiftUI

struct DetailView: View {
    let item: MediaItem

    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var theme: ThemeStore
    @EnvironmentObject private var library: LibraryStore
    @EnvironmentObject private var router: AppRouter

    @State private var details: MediaDetails?
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var selectedSeason = 1
    @State private var seasonDetails: SeasonDetails?
    @State private var seasonLoading = false
    @State private var playerRequest: PlayerRequest?

    var body: some View {
        GeometryReader { geometry in
            let isPad = UIDevice.current.userInterfaceIdiom == .pad
            let isLandscape = geometry.size.width > geometry.size.height
            let edge = isPad ? max(34, min(52, geometry.size.width * 0.036)) : 18
            let heroHeight: CGFloat = {
                guard isPad else { return 520 }
                if isLandscape {
                    return min(620, max(500, geometry.size.height * 0.70))
                }
                return min(600, max(520, geometry.size.height * 0.48))
            }()

            ZStack(alignment: .top) {
                Color.black.ignoresSafeArea()

                if let details {
                    ScrollView(showsIndicators: false) {
                        VStack(alignment: .leading, spacing: 0) {
                            detailHero(
                                details,
                                height: heroHeight,
                                width: geometry.size.width,
                                edge: edge,
                                isPad: isPad,
                                isLandscape: isLandscape
                            )
                            detailBody(
                                details,
                                edge: edge,
                                isPad: isPad,
                                availableWidth: geometry.size.width
                            )
                        }
                    }
                    .ignoresSafeArea(edges: .top)
                } else if isLoading {
                    NativeLoadingView(text: "Opening \(item.displayTitle)")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let errorMessage {
                    ErrorPanel(title: "Couldn't open this title", message: errorMessage) {
                        Task { await loadDetails() }
                    }
                    .padding(24)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                }

                HStack {
                    GlassIconButton(symbol: "chevron.left", label: "Back", tint: .black.opacity(0.10)) {
                        theme.impact()
                        dismiss()
                    }
                    Spacer()

                    if details != nil {
                        Button {
                            library.toggle(item, haptics: theme.hapticsEnabled)
                        } label: {
                            Image(systemName: library.contains(item) ? "bookmark.fill" : "bookmark")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(library.contains(item) ? theme.accent : .white.opacity(0.92))
                                .frame(width: 42, height: 42)
                        }
                        .buttonStyle(.plain)
                        .synflixCircleGlass(tint: theme.accent.opacity(library.contains(item) ? 0.12 : 0.025))
                        .accessibilityLabel(library.contains(item) ? "Remove from My List" : "Add to My List")
                    }
                }
                .padding(.horizontal, edge)
                .padding(.top, geometry.safeAreaInsets.top + 9)
            }
        }
        .task { await loadDetails() }
        .fullScreenCover(item: $playerRequest) { request in
            NativePlayerView(request: request)
                .environmentObject(theme)
        }
    }

    private func detailHero(
        _ details: MediaDetails,
        height: CGFloat,
        width: CGFloat,
        edge: CGFloat,
        isPad: Bool,
        isLandscape: Bool
    ) -> some View {
        ZStack(alignment: .bottomLeading) {
            AsyncImage(url: details.backdropURL ?? item.backdropURL ?? details.posterURL) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                default:
                    LinearGradient(
                        colors: [theme.accent.opacity(0.14), .black],
                        startPoint: .topTrailing,
                        endPoint: .bottomLeading
                    )
                }
            }
            .frame(width: width, height: height)
            .clipped()

            LinearGradient(
                colors: [.black.opacity(0.08), .black.opacity(0.08), .black.opacity(0.78), .black],
                startPoint: .top,
                endPoint: .bottom
            )

            LinearGradient(
                colors: [.black.opacity(isPad ? 0.78 : 0.60), .black.opacity(0.18), .clear],
                startPoint: .leading,
                endPoint: .trailing
            )

            VStack(alignment: .leading, spacing: isPad ? 13 : 12) {
                HStack(spacing: 7) {
                    SynFlixBrandMark(size: 18)
                    Text(item.kind == "tv" ? "SYNFLIX SERIES" : "SYNFLIX MOVIE")
                        .font(.system(size: 9.5, weight: .black))
                        .tracking(1.4)
                        .foregroundStyle(.white.opacity(0.56))
                }

                Text(details.displayTitle)
                    .font(.system(size: isPad ? (isLandscape ? 54 : 48) : 37, weight: .heavy))
                    .tracking(isPad ? -1.65 : -1.2)
                    .lineLimit(2)
                    .minimumScaleFactor(0.82)
                    .frame(maxWidth: isPad ? min(720, width * (isLandscape ? 0.52 : 0.66)) : 440, alignment: .leading)

                HStack(spacing: 8) {
                    if !details.year.isEmpty { Text(details.year) }
                    if let score = details.vote_average, score > 0 {
                        Text("•")
                        Image(systemName: "star.fill")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(theme.accent)
                        Text(String(format: "%.1f", score))
                    }
                    if let runtime = details.runtimeText {
                        Text("•")
                        Text(runtime)
                    } else if let seasons = details.number_of_seasons, seasons > 0 {
                        Text("•")
                        Text("\(seasons) \(seasons == 1 ? "Season" : "Seasons")")
                    }
                }
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(.white.opacity(0.66))

                if isPad, let overview = details.overview, !overview.isEmpty {
                    Text(overview)
                        .font(.system(size: 14.5))
                        .foregroundStyle(.white.opacity(0.64))
                        .lineSpacing(3)
                        .lineLimit(3)
                        .frame(maxWidth: min(620, width * (isLandscape ? 0.46 : 0.62)), alignment: .leading)
                }

                HStack(spacing: 10) {
                    AccentActionButton(title: item.kind == "tv" ? "Play S\(selectedSeason) E1" : "Play", symbol: "play.fill", accent: theme.accent) {
                        theme.impact(.medium)
                        playerRequest = PlayerRequest(
                            media: item,
                            season: item.kind == "tv" ? selectedSeason : nil,
                            episode: item.kind == "tv" ? 1 : nil
                        )
                    }

                    GlassActionButton(
                        title: library.contains(item) ? "In My List" : "My List",
                        symbol: library.contains(item) ? "checkmark" : "plus",
                        tint: theme.accent.opacity(0.045)
                    ) {
                        library.toggle(item, haptics: theme.hapticsEnabled)
                    }
                }
            }
            .padding(.horizontal, edge)
            .padding(.bottom, isPad ? 34 : 26)
        }
        .frame(width: width, height: height)
        .clipped()
    }

    @ViewBuilder
    private func detailBody(
        _ details: MediaDetails,
        edge: CGFloat,
        isPad: Bool,
        availableWidth: CGFloat
    ) -> some View {
        let contentWidth = isPad ? min(1180, availableWidth - edge * 2) : availableWidth

        VStack(alignment: .leading, spacing: isPad ? 32 : 28) {
            if let overview = details.overview, !overview.isEmpty, !isPad {
                VStack(alignment: .leading, spacing: 10) {
                    Text("About")
                        .font(.system(size: 19, weight: .bold))
                        .tracking(-0.4)
                    Text(overview)
                        .font(.system(size: 14.5))
                        .foregroundStyle(.white.opacity(0.62))
                        .lineSpacing(4)
                }
                .padding(.horizontal, edge)
            }

            if let genres = details.genres, !genres.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 9) {
                        ForEach(genres) { genre in
                            Text(genre.name)
                                .font(.system(size: 11.5, weight: .semibold))
                                .foregroundStyle(.white.opacity(0.72))
                                .padding(.horizontal, 13)
                                .frame(height: 34)
                                .synflixGlass(tint: theme.accent.opacity(0.020), cornerRadius: 17)
                        }
                    }
                    .padding(.horizontal, edge)
                }
            }

            if item.kind == "tv" {
                episodesSection(details, edge: edge, isPad: isPad)
            }

            if let cast = details.credits?.cast, !cast.isEmpty {
                VStack(alignment: .leading, spacing: 13) {
                    Text("Cast")
                        .font(.system(size: isPad ? 21 : 19, weight: .bold))
                        .tracking(-0.4)
                        .padding(.horizontal, edge)

                    ScrollView(.horizontal, showsIndicators: false) {
                        LazyHStack(spacing: isPad ? 16 : 14) {
                            ForEach(Array(cast.prefix(18))) { person in
                                VStack(alignment: .leading, spacing: 7) {
                                    ArtworkView(url: person.profileURL, cornerRadius: isPad ? 16 : 18)
                                        .frame(width: isPad ? 108 : 96, height: isPad ? 136 : 118)
                                    Text(person.name)
                                        .font(.system(size: isPad ? 12 : 11.5, weight: .semibold))
                                        .lineLimit(1)
                                    if let character = person.character, !character.isEmpty {
                                        Text(character)
                                            .font(.system(size: 10))
                                            .foregroundStyle(.white.opacity(0.35))
                                            .lineLimit(1)
                                    }
                                }
                                .frame(width: isPad ? 108 : 96, alignment: .leading)
                            }
                        }
                        .padding(.horizontal, edge)
                    }
                }
            }

            let related = details.recommendations?.results ?? details.similar?.results ?? []
            if !related.isEmpty {
                MediaShelf(
                    title: "More Like This",
                    items: Array(related.prefix(20)),
                    cardWidth: isPad ? 172 : 138,
                    edgePadding: edge
                )
            }

            Spacer(minLength: 50)
        }
        .frame(width: contentWidth, alignment: .leading)
        .frame(maxWidth: .infinity)
        .padding(.top, isPad ? 14 : 8)
        .padding(.bottom, 36)
        .background(Color.black)
    }

    private func episodesSection(_ details: MediaDetails, edge: CGFloat, isPad: Bool) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Episodes")
                    .font(.system(size: isPad ? 21 : 19, weight: .bold))
                    .tracking(-0.4)

                Spacer()

                if let seasons = details.seasons?.filter({ $0.season_number > 0 }), !seasons.isEmpty {
                    Menu {
                        ForEach(seasons) { season in
                            Button(season.name) {
                                selectedSeason = season.season_number
                                theme.impact()
                                Task { await loadSeason(season.season_number) }
                            }
                        }
                    } label: {
                        HStack(spacing: 6) {
                            Text("Season \(selectedSeason)")
                            Image(systemName: "chevron.up.chevron.down")
                                .font(.system(size: 9, weight: .bold))
                        }
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.82))
                        .padding(.horizontal, 13)
                        .frame(height: 34)
                    }
                    .synflixGlass(tint: theme.accent.opacity(0.028), cornerRadius: 17, interactive: true)
                }
            }
            .padding(.horizontal, edge)

            if seasonLoading {
                HStack {
                    Spacer()
                    ProgressView().tint(theme.accent)
                    Spacer()
                }
                .padding(.vertical, 18)
            } else if let episodes = seasonDetails?.episodes, !episodes.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    LazyHStack(spacing: isPad ? 14 : 12) {
                        ForEach(episodes) { episode in
                            Button {
                                playerRequest = PlayerRequest(media: item, season: episode.season_number, episode: episode.episode_number)
                            } label: {
                                VStack(alignment: .leading, spacing: 8) {
                                    ZStack(alignment: .bottomLeading) {
                                        ArtworkView(url: episode.stillURL, cornerRadius: 10)
                                            .frame(width: isPad ? 318 : 240, height: isPad ? 179 : 135)
                                        LinearGradient(colors: [.clear, .black.opacity(0.66)], startPoint: .center, endPoint: .bottom)
                                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                        Text("E\(episode.episode_number)")
                                            .font(.system(size: 10, weight: .black))
                                            .foregroundStyle(theme.accent)
                                            .padding(10)
                                    }
                                    Text(episode.name)
                                        .font(.system(size: isPad ? 13.5 : 13, weight: .semibold))
                                        .foregroundStyle(.white.opacity(0.90))
                                        .lineLimit(1)
                                        .frame(width: isPad ? 318 : 240, alignment: .leading)
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, edge)
                }
            }
        }
    }

    private func loadDetails() async {
        await MainActor.run {
            isLoading = true
            errorMessage = nil
        }
        do {
            let loaded = try await SynFlixAPI.shared.details(kind: item.kind, id: item.id)
            let preferredSeason = loaded.seasons?.first(where: { $0.season_number > 0 })?.season_number ?? 1
            await MainActor.run {
                details = loaded
                selectedSeason = preferredSeason
                isLoading = false
            }
            if item.kind == "tv" {
                await loadSeason(preferredSeason)
            }
        } catch {
            await MainActor.run {
                errorMessage = error.localizedDescription
                isLoading = false
            }
        }
    }

    private func loadSeason(_ season: Int) async {
        guard item.kind == "tv" else { return }
        await MainActor.run { seasonLoading = true }
        do {
            let loaded = try await SynFlixAPI.shared.season(showID: item.id, season: season)
            await MainActor.run {
                seasonDetails = loaded
                seasonLoading = false
            }
        } catch {
            await MainActor.run { seasonLoading = false }
        }
    }
}
