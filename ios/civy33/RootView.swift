import SwiftUI
import UIKit
import AVKit

// MARK: - Civy 3.3: immersive storefront and floating navigation

private enum CivyTab: String, CaseIterable, Identifiable {
    case home = "Home", clips = "Clips", search = "Search", mine = "My Civy"
    var id: String { rawValue }
    var symbol: String {
        switch self {
        case .home: "house"
        case .clips: "play.rectangle.on.rectangle"
        case .search: "magnifyingglass"
        case .mine: "person.crop.square"
        }
    }
    var selectedSymbol: String {
        switch self {
        case .home: "house.fill"
        case .clips: "play.rectangle.on.rectangle.fill"
        case .search: "magnifyingglass"
        case .mine: "person.crop.square.fill"
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var app: AppState
    @State private var tab: CivyTab = .home
    @AppStorage("civy.appearance.glass") private var glass = true
    @AppStorage("civy.appearance.motion") private var motion = true
    @AppStorage("civy.appearance.reduceMotion") private var reduceMotion = false

    var body: some View {
        ZStack(alignment: .bottom) {
            Color.synBackground.ignoresSafeArea()
            Group {
                switch tab {
                case .home: HomeView()
                case .clips: CivyClipsView()
                case .search: SearchView()
                case .mine: CivyProfileView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .id(tab)
            .transition(.opacity)
            CivyFloatingDock(selected: $tab, glass: glass, animate: motion && !reduceMotion)
                .padding(.horizontal, 19)
                .padding(.bottom, 4)
                .zIndex(5)
        }
        .fullScreenCover(item: $app.playbackRequest) { request in
            PlayerScreen(request: request).id(request.id).environmentObject(app)
        }
    }
}

private struct CivyFloatingDock: View {
    @Binding var selected: CivyTab
    let glass: Bool
    let animate: Bool
    @AppStorage("civy.appearance.haptics") private var haptics = true
    var body: some View {
        HStack(spacing: 2) {
            ForEach(CivyTab.allCases) { tab in
                Button {
                    if haptics { UISelectionFeedbackGenerator().selectionChanged() }
                    if animate { withAnimation(.spring(response: 0.34, dampingFraction: 0.83)) { selected = tab } }
                    else { selected = tab }
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: selected == tab ? tab.selectedSymbol : tab.symbol)
                            .font(.system(size: 23, weight: .semibold))
                            .frame(height: 28)
                            .contentTransition(.symbolEffect(.replace))
                        Text(tab.rawValue)
                            .font(.system(size: 11, weight: selected == tab ? .semibold : .medium))
                            .lineLimit(1).minimumScaleFactor(0.9)
                    }
                    .foregroundStyle(selected == tab ? .white : .white.opacity(0.86))
                    .frame(maxWidth: .infinity)
                    .frame(height: 66)
                    .background {
                        if selected == tab { Capsule().fill(.white.opacity(0.15)).padding(.vertical, 2) }
                    }
                    .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selected == tab ? .isSelected : [])
            }
        }
        .padding(5)
        .background(.black.opacity(0.8), in: Capsule())
        .civyGlassCapsule(glass)
        .overlay(Capsule().strokeBorder(.white.opacity(0.18), lineWidth: 0.8))
        .shadow(color: .black.opacity(0.58), radius: 20, y: 11)
    }
}

private struct CivyAirPlayPicker: UIViewRepresentable {
    func makeUIView(context: Context) -> AVRoutePickerView {
        let view = AVRoutePickerView(frame: .zero)
        view.tintColor = .white
        view.activeTintColor = UIColor(red: 0.91, green: 0.05, blue: 0.1, alpha: 1)
        view.prioritizesVideoDevices = true
        return view
    }
    func updateUIView(_ uiView: AVRoutePickerView, context: Context) { }
}

private enum BrowseFilter: String {
    case all, series, films, hot
}

struct HomeView: View {
    @EnvironmentObject private var app: AppState
    @State private var selected: Media?
    @State private var filter: BrowseFilter = .all
    @State private var heroIndex = 0
    @State private var showCategories = false
    @State private var showDownloads = false
    @State private var showNew = false
    @AppStorage("civy.profile.name") private var profileName = "My Profile"
    @AppStorage("civy.home.editorial") private var showEditorial = true
    @AppStorage("civy.home.top10") private var showTopTen = true
    @AppStorage("civy.home.continue") private var showContinue = true
    @AppStorage("civy.home.genre") private var showGenres = true
    @AppStorage("civy.home.curated") private var showCurated = true
    @AppStorage("civy.home.personalized") private var personalized = true
    @AppStorage("civy.home.heroRotation") private var rotate = true
    @AppStorage("civy.home.heroInterval") private var heroInterval = 10
    @AppStorage("civy.appearance.motion") private var motion = true
    @AppStorage("civy.appearance.reduceMotion") private var reduceMotion = false

    private var heroes: [Media] {
        guard let home = app.home else { return [] }
        let sources: [Media]
        switch filter {
        case .all: sources = home.trending + home.popularMovies
        case .series: sources = home.popularTv
        case .films: sources = home.popularMovies
        case .hot: sources = home.trending + home.upcoming
        }
        return Array(sources.filter { $0.posterPath != nil }.uniquedByKey().prefix(9))
    }
    private var featured: Media? { heroes.isEmpty ? nil : heroes[heroIndex % heroes.count] }
    private var recommended: [Media] {
        guard let home = app.home, let recent = app.history.first?.media else { return [] }
        return (home.trending + home.popularMovies + home.popularTv + home.topRatedMovies)
            .filter { $0.key != recent.key && !$0.genreIds.orEmpty.filter({ recent.genreIds.orEmpty.contains($0) }).isEmpty }
            .uniquedByKey()
    }
    private var continuationTitle: String {
        let name = profileName.trimmingCharacters(in: .whitespacesAndNewlines)
        return "Continue watching for \(name.isEmpty || name == "My Profile" ? "you" : name)"
    }

    var body: some View {
        ZStack {
            LinearGradient(stops: [
                .init(color: Color(red: 0.24, green: 0.115, blue: 0.13), location: 0),
                .init(color: Color(red: 0.16, green: 0.075, blue: 0.084), location: 0.30),
                .init(color: Color.synBackground, location: 0.67),
                .init(color: Color.synBackground, location: 1)
            ], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            if let home = app.home {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        topBar
                        filterBar
                            .padding(.top, 16)
                        if let featured {
                            CivyPosterHero(
                                media: featured,
                                onDetails: { selected = featured },
                                onPlay: { play(featured) },
                                onList: { app.toggleFavorite(featured) }
                            )
                            .id(featured.key)
                            .transition(.opacity.combined(with: .scale(scale: 0.985)))
                            .padding(.horizontal, 17)
                            .padding(.top, 31)
                        }
                        if showContinue && !app.history.isEmpty {
                            ContinueWatchingRail(history: app.history, heading: continuationTitle) { selected = $0 }
                                .padding(.top, 25)
                        }
                        if filter == .all || filter == .hot {
                            MediaRail(title: "Trending Now", items: home.trending, kicker: nil) { selected = $0 }
                                .padding(.top, 26)
                        }
                        if showTopTen {
                            RankedRail(items: topTen(home)) { selected = $0 }
                                .padding(.top, 30)
                        }
                        if showEditorial {
                            EditorialRail(items: (filter == .series ? home.popularTv : home.trending).filter { $0.backdropPath != nil }) { selected = $0 }
                                .padding(.top, 30)
                        }
                        if personalized && !recommended.isEmpty && filter == .all, let last = app.history.first {
                            MediaRail(title: "Because You Watched \(last.media.displayTitle)", items: recommended, kicker: nil) { selected = $0 }
                                .padding(.top, 28)
                        }
                        if filter != .series {
                            MediaRail(title: "Films Everyone's Watching", items: home.popularMovies, kicker: nil) { selected = $0 }.padding(.top, 28)
                            LandscapeRail(title: "Big Screen Favorites", items: home.nowPlaying, kicker: nil) { selected = $0 }.padding(.top, 28)
                        }
                        if filter != .films {
                            MediaRail(title: "Binge-Worthy Series", items: home.popularTv, kicker: nil) { selected = $0 }.padding(.top, 28)
                            LandscapeRail(title: "Critically Acclaimed", items: home.topRatedTv, kicker: nil) { selected = $0 }.padding(.top, 28)
                        }
                        if showGenres && filter != .series {
                            GenreDiscoveryRail(onPick: { selected = $0 }, titles: home.popularMovies + home.topRatedMovies)
                                .padding(.top, 29)
                        }
                        if showCurated {
                            ForEach(["Sci-Fi Worlds", "High-Stakes Thrillers", "Comedy Nights", "Crime Stories"], id: \.self) { title in
                                if let items = app.curated[title], !items.isEmpty {
                                    MediaRail(title: title, items: items, kicker: nil) { selected = $0 }.padding(.top, 28)
                                }
                            }
                        }
                        if filter != .series {
                            MediaRail(title: "Award-Worthy Films", items: home.topRatedMovies, kicker: nil) { selected = $0 }.padding(.top, 28)
                            LandscapeRail(title: "Coming Soon", items: home.upcoming, kicker: nil) { selected = $0 }.padding(.top, 28)
                        }
                        if !app.favorites.isEmpty && filter == .all {
                            MediaRail(title: "My List", items: app.favorites, kicker: nil) { selected = $0 }.padding(.top, 28)
                        }
                        Text("civy")
                            .font(.system(size: 21, weight: .black, design: .rounded))
                            .foregroundStyle(.white.opacity(0.2))
                            .frame(maxWidth: .infinity)
                            .padding(.top, 42)
                        Spacer(minLength: 112)
                    }
                    .padding(.top, 7)
                }
                .scrollIndicators(.hidden)
                .refreshable { await app.loadHome() }
            } else if app.isLoadingHome {
                VStack(spacing: 16) {
                    ProgressView().tint(Color.synAccent)
                    Text("Finding something you'll love")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(.white.opacity(0.8))
                }
            } else {
                EmptyState(symbol: "wifi.exclamationmark", title: "Couldn't load Civy", subtitle: app.homeError ?? "Check your connection and try again.", actionTitle: "Retry") { Task { await app.loadHome() } }
            }
        }
        .sheet(item: $selected) { DetailView(media: $0).environmentObject(app) }
        .sheet(isPresented: $showCategories) { CivyGenreBrowser().environmentObject(app) }
        .sheet(isPresented: $showDownloads) { CivyDownloadsView().environmentObject(app) }
        .sheet(isPresented: $showNew) { CivyNewAndHotView().environmentObject(app) }
        .task {
            if app.home == nil { await app.loadHome() }
            await app.loadCurated()
        }
        .task(id: "\(filter.rawValue)-\(heroInterval)") {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(Double(max(4,heroInterval))))
                if Task.isCancelled { break }
                if rotate && heroes.count > 1 {
                    if motion && !reduceMotion {
                        withAnimation(.easeInOut(duration: 0.52)) { heroIndex = (heroIndex + 1) % heroes.count }
                    } else { heroIndex = (heroIndex + 1) % heroes.count }
                }
            }
        }
    }

    private var topBar: some View {
        HStack(spacing: 11) {
            Text("C")
                .font(.system(size: 45, weight: .black, design: .rounded))
                .italic()
                .tracking(-4)
                .foregroundStyle(Color.synAccent)
                .frame(width: 36, alignment: .leading)
                .accessibilityLabel("Civy")
            Text(filter == .all ? "Home" : filter == .series ? "Series" : filter == .films ? "Films" : "New & Hot")
                .font(.system(size: 26, weight: .bold))
                .tracking(-0.9)
                .lineLimit(1).minimumScaleFactor(0.76)
            Spacer(minLength: 4)
            CivyAirPlayPicker().frame(width: 39, height: 39)
                .accessibilityLabel("AirPlay and casting")
            Button { showDownloads = true } label: {
                Image(systemName: "arrow.down.to.line")
                    .font(.system(size: 24, weight: .medium))
                    .frame(width: 42, height: 42)
            }
            .accessibilityLabel("Downloads")
            Button { showNew = true } label: {
                Image(systemName: "bell")
                    .font(.system(size: 24, weight: .medium))
                    .frame(width: 42, height: 42)
            }
            .accessibilityLabel("What's new")
        }
        .buttonStyle(.plain)
        .foregroundStyle(.white)
        .padding(.horizontal, 18)
        .frame(height: 51)
    }

    private var filterBar: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 9) {
                pill("Series", isSelected: filter == .series) { changeFilter(.series) }
                pill("Films", isSelected: filter == .films) { changeFilter(.films) }
                pill("New & Hot", isSelected: filter == .hot) { changeFilter(.hot) }
                pill("Categories", isSelected: false) { showCategories = true }
            }
            .padding(.horizontal, 17)
        }
        .scrollIndicators(.hidden)
    }
    private func pill(_ label: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white)
                .padding(.horizontal, 19)
                .frame(height: 43)
                .background(isSelected ? Color.synAccent.opacity(0.30) : Color.black.opacity(0.76), in: Capsule())
                .overlay(Capsule().strokeBorder(.white.opacity(isSelected ? 0.26 : 0.10), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
    private func changeFilter(_ next: BrowseFilter) {
        let to = filter == next ? BrowseFilter.all : next
        if motion && !reduceMotion { withAnimation(.easeInOut(duration: 0.3)) { filter = to; heroIndex = 0 } }
        else { filter = to; heroIndex = 0 }
    }
    private func topTen(_ home: HomeResponse) -> [Media] {
        switch filter {
        case .all, .hot: return home.trending.uniquedByKey()
        case .films: return home.popularMovies.uniquedByKey()
        case .series: return home.popularTv.uniquedByKey()
        }
    }
    private func play(_ media: Media) {
        let saved = app.progress(for: media)
        app.play(media, season: media.kind == "tv" ? saved?.season ?? 1 : nil, episode: media.kind == "tv" ? saved?.episode ?? 1 : nil)
    }
}

private extension Optional where Wrapped == [Int] { var orEmpty: [Int] { self ?? [] } }
private extension Array where Element == Media {
    func uniquedByKey() -> [Media] {
        var seen = Set<String>()
        return filter { seen.insert($0.key).inserted }
    }
}

private struct CivyPosterHero: View {
    let media: Media
    let onDetails: () -> Void
    let onPlay: () -> Void
    let onList: () -> Void
    @EnvironmentObject private var app: AppState
    @State private var details: MediaDetails?
    @AppStorage("civy.appearance.largeArtwork") private var largeArt = true
    @AppStorage("civy.appearance.glass") private var glass = true
    @AppStorage("civy.appearance.haptics") private var haptics = true

    private var imageURL: URL? { TMDBImage.url(media.posterPath, size: largeArt ? "original" : "w780") ?? media.originalBackdropURL }
    private var genres: String {
        let result = details?.genres?.prefix(2).map(\.name).joined(separator: " · ")
        return (result?.isEmpty == false ? result! : media.genreLabel)
    }
    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .bottom) {
                AsyncImage(url: imageURL, transaction: Transaction(animation: .easeInOut(duration: 0.42))) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFill()
                    } else {
                        LinearGradient(colors: [Color(red: 0.38, green: 0.07, blue: 0.10), Color.synSurface], startPoint: .top, endPoint: .bottom)
                    }
                }
                .frame(width: geo.size.width, height: geo.size.height)
                .clipped()
                .contentShape(Rectangle())
                .onTapGesture(perform: onDetails)

                LinearGradient(stops: [
                    .init(color: .black.opacity(0.18), location: 0),
                    .init(color: .clear, location: 0.33),
                    .init(color: .black.opacity(0.04), location: 0.56),
                    .init(color: .black.opacity(0.30), location: 0.71),
                    .init(color: .black.opacity(0.89), location: 0.93),
                    .init(color: .black.opacity(0.96), location: 1)
                ], startPoint: .top, endPoint: .bottom)
                .allowsHitTesting(false)

                VStack(spacing: 0) {
                    HStack {
                        Text("C")
                            .font(.system(size: 45, weight: .black, design: .rounded))
                            .italic().tracking(-4)
                            .foregroundStyle(Color.synAccent)
                            .accessibilityHidden(true)
                        Spacer()
                    }
                    .padding(.leading, 13).padding(.top, 12)
                    Spacer(minLength: 8)
                    VStack(spacing: 16) {
                        if let logo = details?.heroLogo {
                            AsyncImage(url: logo) { phase in
                                if let image = phase.image { image.resizable().scaledToFit() }
                                else { titleFallback }
                            }
                            .frame(maxWidth: geo.size.width * 0.78, maxHeight: 106)
                        } else { titleFallback }
                        Text("\(media.kind == "tv" ? "Series" : "Film")\(genres.isEmpty ? "" : "  ·  \(genres)")")
                            .font(.system(size: 15, weight: .medium))
                            .foregroundStyle(.white.opacity(0.95))
                            .lineLimit(1).minimumScaleFactor(0.7)
                            .padding(.horizontal, 12)
                        HStack(spacing: 11) {
                            Button {
                                if haptics { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
                                onPlay()
                            } label: {
                                Label(app.progress(for: media) == nil ? "Play" : "Resume", systemImage: "play.fill")
                                    .font(.system(size: 18, weight: .bold))
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 49)
                                    .foregroundStyle(.black)
                                    .background(.white, in: Capsule())
                            }
                            Button {
                                if haptics { UISelectionFeedbackGenerator().selectionChanged() }
                                onList()
                            } label: {
                                Label(app.isFavorite(media) ? "Added" : "My List", systemImage: app.isFavorite(media) ? "checkmark" : "plus")
                                    .font(.system(size: 17, weight: .semibold))
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 49)
                                    .foregroundStyle(.white)
                                    .background(Color.black.opacity(0.70), in: Capsule())
                                    .civyGlassCapsule(glass)
                                    .overlay(Capsule().strokeBorder(.white.opacity(0.15)))
                            }
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 18)
                }
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
        .aspectRatio(0.705, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(.white.opacity(0.16), lineWidth: 1))
        .shadow(color: .black.opacity(0.26), radius: 8, y: 7)
        .task(id: media.key) { details = nil; details = try? await app.api.details(media) }
    }
    private var titleFallback: some View {
        Text(media.displayTitle)
            .font(.system(size: 33, weight: .black))
            .tracking(-1.25)
            .multilineTextAlignment(.center)
            .foregroundStyle(.white)
            .lineLimit(3)
            .minimumScaleFactor(0.78)
            .shadow(color: .black.opacity(0.8), radius: 12)
            .frame(maxWidth: 300)
    }
}

// MARK: - Bottom destinations

private struct CivyProfileView: View {
    @EnvironmentObject private var app: AppState
    @AppStorage("civy.profile.name") private var profileName = "My Profile"
    @AppStorage("civy.profile.icon") private var profileIcon = "person.fill"
    @State private var showList = false
    @State private var showSettings = false
    @State private var selected: Media?

    var body: some View {
        NavigationStack {
            ZStack {
                Color.synBackground.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 22) {
                        HStack(spacing: 15) {
                            Image(systemName: profileIcon)
                                .font(.system(size: 27, weight: .medium))
                                .frame(width: 70, height: 70)
                                .background(Color.synAccent.gradient, in: RoundedRectangle(cornerRadius: 22))
                            VStack(alignment: .leading, spacing: 5) {
                                Text(profileName).font(.system(size: 26, weight: .bold))
                                Text("Your space on Civy").font(.system(size: 14)).foregroundStyle(.secondary)
                            }
                            Spacer()
                        }
                        .padding(18)
                        .background(Color.synSurface, in: RoundedRectangle(cornerRadius: 25))
                        HStack(spacing: 12) {
                            summary("\(app.favorites.count)", "Saved")
                            summary("\(app.history.count)", "Watched")
                        }
                        Button { showList = true } label: { profileAction("My List", "rectangle.stack.fill", "Your saved films and series") }
                        Button { showSettings = true } label: { profileAction("App Settings", "slider.horizontal.3", "Playback, quality, Liquid Glass, privacy") }
                        if !app.history.isEmpty {
                            ContinueWatchingRail(history: app.history, heading: "Continue Watching") { selected = $0 }
                                .padding(.horizontal, -18)
                        }
                        Text("Civy brings your library and preferences together on this device.")
                            .font(.system(size: 13)).foregroundStyle(.white.opacity(0.46))
                        Spacer(minLength: 112)
                    }
                    .padding(.horizontal, 18).padding(.top, 20)
                }.scrollIndicators(.hidden)
            }
            .navigationTitle("My Civy")
            .navigationBarTitleDisplayMode(.large)
            .sheet(isPresented: $showList) { MyListView().environmentObject(app) }
            .sheet(isPresented: $showSettings) { SettingsView().environmentObject(app) }
            .sheet(item: $selected) { DetailView(media: $0).environmentObject(app) }
        }
    }
    private func summary(_ count: String, _ label: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(count).font(.system(size: 28, weight: .bold))
            Text(label).font(.system(size: 13)).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(17)
        .background(Color.synSurface, in: RoundedRectangle(cornerRadius: 18))
    }
    private func profileAction(_ title: String, _ symbol: String, _ sub: String) -> some View {
        HStack(spacing: 15) {
            Image(systemName: symbol).font(.system(size: 21)).frame(width: 36)
                .foregroundStyle(Color.synAccent)
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.system(size: 17, weight: .semibold))
                Text(sub).font(.system(size: 13)).foregroundStyle(.secondary)
            }
            Spacer()
            Image(systemName: "chevron.right").foregroundStyle(.secondary)
        }
        .foregroundStyle(.white)
        .padding(17)
        .background(Color.synSurface, in: RoundedRectangle(cornerRadius: 19))
    }
}

private struct CivyDownloadsView: View {
    @EnvironmentObject private var app: AppState
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            ZStack {
                Color.synBackground.ignoresSafeArea()
                VStack(spacing: 15) {
                    Image(systemName: "arrow.down.circle")
                        .font(.system(size: 44, weight: .light))
                        .foregroundStyle(Color.synAccent)
                        .frame(width: 104, height: 104)
                        .glassEffect(.regular, in: Circle())
                    Text("Downloads").font(.system(size: 26, weight: .bold))
                    Text("Offline video downloads aren't currently supported by Civy's streaming sources. Titles in My List are bookmarks, not files saved to your iPhone.")
                        .font(.system(size: 15)).foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                }
            }
            .navigationTitle("Downloads")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Done") { dismiss() } } }
        }
    }
}

private struct CivyNewAndHotView: View {
    @EnvironmentObject private var app: AppState
    @Environment(\.dismiss) private var dismiss
    @State private var selected: Media?
    var body: some View {
        NavigationStack {
            ZStack {
                Color.synBackground.ignoresSafeArea()
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 14) {
                        Text("Coming Up")
                            .font(.system(size: 30, weight: .bold))
                            .padding(.horizontal, 19).padding(.top, 12)
                        ForEach((app.home?.upcoming ?? []).prefix(20)) { media in
                            Button { selected = media } label: {
                                HStack(spacing: 14) {
                                    MovieImage(url: media.posterURL, radius: 9).frame(width: 76)
                                    VStack(alignment: .leading, spacing: 6) {
                                        Text(media.displayTitle).font(.system(size: 17, weight: .semibold)).lineLimit(2)
                                        Text(media.year.isEmpty ? "Coming soon" : "Expected \(media.year)")
                                            .font(.system(size: 13)).foregroundStyle(.secondary)
                                        if !media.genreLabel.isEmpty { Text(media.genreLabel).font(.system(size: 12)).foregroundStyle(Color.synAccent).lineLimit(1) }
                                    }
                                    Spacer()
                                    Image(systemName: "chevron.right").foregroundStyle(.secondary)
                                }
                                .padding(12)
                                .background(Color.synSurface, in: RoundedRectangle(cornerRadius: 16))
                            }
                            .buttonStyle(.plain)
                            .foregroundStyle(.white)
                        }
                        Spacer(minLength: 28)
                    }.padding(.horizontal, 17)
                }.scrollIndicators(.hidden)
            }
            .navigationTitle("New & Hot")
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Done") { dismiss() } } }
            .sheet(item: $selected) { DetailView(media: $0).environmentObject(app) }
        }
    }
}

private struct CivyGenreBrowser: View {
    @EnvironmentObject private var app: AppState
    @Environment(\.dismiss) private var dismiss
    @State private var genreID: Int?
    @State private var genreName = ""
    @State private var items: [Media] = []
    @State private var loading = false
    @State private var selected: Media?
    private let genres: [(String, Int, String)] = [
        ("Action", 28, "bolt.fill"), ("Adventure", 12, "safari.fill"), ("Comedy", 35, "face.smiling.fill"),
        ("Drama", 18, "theatermasks.fill"), ("Fantasy", 14, "sparkles"), ("Sci-Fi", 878, "moon.stars.fill"),
        ("Thrillers", 53, "eye.fill"), ("Animation", 16, "paintpalette.fill"), ("Horror", 27, "ghost.fill"),
        ("Romance", 10749, "heart.fill"), ("Crime", 80, "shield.fill"), ("Family", 10751, "figure.2.and.child.holdinghands")
    ]
    private let columns = [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]
    var body: some View {
        NavigationStack {
            ZStack {
                Color.synBackground.ignoresSafeArea()
                ScrollView {
                    if genreID == nil {
                        LazyVGrid(columns: columns, spacing: 12) {
                            ForEach(genres, id: \.1) { genre in
                                Button { genreID = genre.1; genreName = genre.0 } label: {
                                    VStack(alignment: .leading, spacing: 23) {
                                        Image(systemName: genre.2).font(.system(size: 25)).foregroundStyle(Color.synAccent)
                                        Text(genre.0).font(.system(size: 19, weight: .bold))
                                    }
                                    .frame(maxWidth: .infinity, minHeight: 113, alignment: .leading)
                                    .padding(15)
                                    .background(Color.synSurface, in: RoundedRectangle(cornerRadius: 18))
                                }.buttonStyle(.plain).foregroundStyle(.white)
                            }
                        }.padding(17)
                    } else if loading {
                        ProgressView().padding(.top, 90)
                    } else {
                        LazyVGrid(columns: [GridItem(.flexible()),GridItem(.flexible()),GridItem(.flexible())], spacing: 13) {
                            ForEach(items) { media in
                                MediaCard(media: media, width: 105) { selected = $0 }
                            }
                        }.padding(15)
                    }
                }.scrollIndicators(.hidden)
            }
            .navigationTitle(genreID == nil ? "Categories" : genreName)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    if genreID != nil { Button("Back") { genreID = nil; items = [] } }
                }
                ToolbarItem(placement: .topBarTrailing) { Button("Done") { dismiss() } }
            }
            .task(id: genreID) {
                guard let genreID else { return }
                loading = true
                items = (try? await app.api.discover(kind: "movie", genre: genreID)) ?? []
                loading = false
            }
            .sheet(item: $selected) { DetailView(media: $0).environmentObject(app) }
        }
    }
}

private struct CivyPreview: Identifiable {
    let media: Media
    let trailer: URL?
    var id: String { media.key }
}

private struct CivyClipsView: View {
    @EnvironmentObject private var app: AppState
    @Environment(\.openURL) private var openURL
    @State private var previews: [CivyPreview] = []
    @State private var selected: Media?
    @State private var loading = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color.synBackground.ignoresSafeArea()
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 22) {
                        VStack(alignment: .leading, spacing: 5) {
                            Text("Clips & Trailers").font(.system(size: 31, weight: .bold))
                            Text("A closer look at what's worth watching")
                                .font(.system(size: 14)).foregroundStyle(.secondary)
                        }.padding(.horizontal, 20).padding(.top, 17)
                        if previews.isEmpty && loading { ProgressView("Finding trailers…").padding(.top, 65) }
                        ForEach(previews) { preview in
                            VStack(alignment: .leading, spacing: 12) {
                                ZStack(alignment: .bottomLeading) {
                                    MovieImage(url: preview.media.backdropURL, aspect: 1.78, radius: 16)
                                    LinearGradient(colors: [.clear, .black.opacity(0.78)], startPoint: .center, endPoint: .bottom)
                                        .clipShape(RoundedRectangle(cornerRadius: 16))
                                    Image(systemName: preview.trailer == nil ? "info.circle.fill" : "play.fill")
                                        .font(.system(size: 20))
                                        .foregroundStyle(.white)
                                        .frame(width: 54, height: 54)
                                        .background(.black.opacity(0.5), in: Circle())
                                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                                }
                                .frame(height: 204)
                                HStack {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(preview.media.displayTitle).font(.system(size: 18, weight: .bold)).lineLimit(1)
                                        Text(preview.trailer == nil ? "About this title" : "Official trailer")
                                            .font(.system(size: 13)).foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    Button(preview.trailer == nil ? "Details" : "Watch") {
                                        if let trailer = preview.trailer { openURL(trailer) }
                                        else { selected = preview.media }
                                    }
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 18).padding(.vertical, 10)
                                    .glassEffect(.regular, in: Capsule())
                                }
                            }
                            .foregroundStyle(.white)
                            .padding(14)
                            .background(Color.synSurface, in: RoundedRectangle(cornerRadius: 20))
                            .padding(.horizontal, 17)
                        }
                        Spacer(minLength: 105)
                    }
                }.scrollIndicators(.hidden)
            }
            .toolbar(.hidden, for: .navigationBar)
            .sheet(item: $selected) { DetailView(media: $0).environmentObject(app) }
            .task {
                if app.home == nil { await app.loadHome() }
                guard previews.isEmpty && !loading else { return }
                loading = true
                let titles = Array((app.home?.trending ?? []).prefix(9))
                // Real TMDB official trailers; the Watch action opens the provider's trailer URL.
                for media in titles {
                    if Task.isCancelled { break }
                    let details = try? await app.api.details(media)
                    let video = details?.videos?.results.first(where: { $0.site == "YouTube" && ($0.type == "Trailer" || $0.type == "Teaser") })
                    let link = video.flatMap { URL(string: "https://www.youtube.com/watch?v=\($0.key)") }
                    previews.append(CivyPreview(media: media, trailer: link))
                }
                loading = false
            }
        }
    }
}

private struct GenreDiscoveryRail: View {
    let onPick: (Media) -> Void
    let titles: [Media]
    private let categories: [(String, Int, String)] = [("Action", 28, "bolt.fill"), ("Comedy", 35, "face.smiling.fill"), ("Thriller", 53, "eye.fill"), ("Sci-Fi", 878, "sparkles"), ("Horror", 27, "moon.stars.fill"), ("Romance", 10749, "heart.fill")]
    @State private var selectedID: Int = 28
    var body: some View {
        VStack(alignment: .leading, spacing: 15) {
            SectionTitle(text: "Find your mood", kicker: "Every kind of movie night")
            ScrollView(.horizontal) {
                HStack(spacing: 9) {
                    ForEach(categories.indices, id: \.self) { index in
                        let entry = categories[index]
                        Button { withAnimation(.snappy(duration: 0.32)) { selectedID = entry.1 } } label: {
                            Label(entry.0, systemImage: entry.2)
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 16).padding(.vertical, 11)
                                .background(selectedID == entry.1 ? Color.synAccent : Color.synElevated, in: Capsule())
                        }.buttonStyle(.plain)
                    }
                }.padding(.horizontal, 21)
            }.scrollIndicators(.hidden)
            let matching = titles.filter { $0.genreIds?.contains(selectedID) == true }
            if !matching.isEmpty {
                ScrollView(.horizontal) {
                    LazyHStack(spacing: 11) { ForEach(Array(matching.prefix(18))) { media in MediaCard(media: media, onTap: onPick) } }
                        .padding(.horizontal, 21)
                }.scrollIndicators(.hidden)
            }
        }
    }
}



struct ContinueWatchingRail: View {
    let history: [WatchRecord]
    var heading: String = "Continue Watching"
    let onDetails: (Media) -> Void
    @EnvironmentObject private var app: AppState
    var body: some View {
        VStack(alignment: .leading, spacing: 15) {
            Text(heading)
                .font(.system(size: 22, weight: .bold))
                .tracking(-0.6)
                .foregroundStyle(.white)
                .padding(.horizontal, 17)
            ScrollView(.horizontal) {
                LazyHStack(spacing: 11) {
                    ForEach(history.prefix(14)) { record in
                        Button { app.play(record.media, season: record.season, episode: record.episode) } label: {
                            ZStack(alignment: .bottom) {
                                MovieImage(url: record.media.posterURL, aspect: 0.78, radius: 10)
                                    .frame(width: 128)
                                LinearGradient(colors: [.clear, .black.opacity(0.46)], startPoint: .center, endPoint: .bottom)
                                    .clipShape(RoundedRectangle(cornerRadius: 10))
                                Image(systemName: "play.fill")
                                    .font(.system(size: 17, weight: .bold))
                                    .foregroundStyle(.white)
                                    .frame(width: 46, height: 46)
                                    .background(.black.opacity(0.55), in: Circle())
                                    .overlay(Circle().strokeBorder(.white.opacity(0.72), lineWidth: 2))
                                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                                Text(record.media.displayTitle)
                                    .font(.system(size: 12, weight: .semibold))
                                    .lineLimit(1)
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 7)
                                    .padding(.bottom, 10)
                            }
                            .frame(width: 128)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Resume \(record.media.displayTitle)")
                    }
                }
                .padding(.horizontal, 17)
            }
            .scrollIndicators(.hidden)
        }
    }
}