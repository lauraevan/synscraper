import SwiftUI

// Fast, native search with recent queries, browse filters and intentional
// loading / retry states. Search runs only through Civy's existing catalog API.
private enum CivySearchScope: String, CaseIterable, Identifiable {
    case all = "All"
    case films = "Films"
    case series = "Series"
    var id: String { rawValue }
}

struct SearchView: View {
    @EnvironmentObject private var app: AppState
    @Environment(\.verticalSizeClass) private var verticalSizeClass
    @FocusState private var searchFocused: Bool
    @AppStorage("civy.search.recentQueries") private var recentValue = ""
    @State private var query = ""
    @State private var results: [Media] = []
    @State private var scope: CivySearchScope = .all
    @State private var isSearching = false
    @State private var searchError: String?
    @State private var retryToken = 0
    @State private var selected: Media?
    @State private var showList = false
    @State private var showNew = false

    private var cleanedQuery: String { query.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var isQueryEmpty: Bool { cleanedQuery.isEmpty }
    private var recentQueries: [String] {
        Array(recentValue.split(separator: "\n").prefix(6).map(String.init))
    }
    private var recommended: [Media] {
        guard let home = app.home else { return [] }
        var seen = Set<String>()
        return (home.trending + home.popularTv + home.popularMovies + home.topRatedMovies)
            .filter { ($0.backdropPath != nil || $0.posterPath != nil) && seen.insert($0.key).inserted }
            .prefix(28).map { $0 }
    }
    private var displayed: [Media] {
        let source = isQueryEmpty ? recommended : results
        switch scope {
        case .all: return source
        case .films: return source.filter { $0.kind != "tv" }
        case .series: return source.filter { $0.kind == "tv" }
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.synBackground.ignoresSafeArea()
                VStack(spacing: 0) {
                    header
                    searchField
                    Picker("Show titles", selection: $scope) {
                        ForEach(CivySearchScope.allCases) { filter in
                            Text(filter.rawValue).tag(filter)
                        }
                    }
                    .pickerStyle(.segmented)
                    .accessibilityIdentifier("civy.search.scope")
                    .padding(.horizontal, 18)
                    .padding(.top, 13)
                    .padding(.bottom, 12)

                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 13) {
                            if isQueryEmpty && !recentQueries.isEmpty {
                                recentSection
                                    .padding(.bottom, 9)
                            }
                            HStack(alignment: .firstTextBaseline) {
                                Text(isQueryEmpty ? "Explore titles" : "Search results")
                                    .font(.system(size: 24, weight: .bold))
                                    .tracking(-0.6)
                                Spacer()
                                if !isQueryEmpty && !isSearching && searchError == nil {
                                    Text("\(displayed.count) found")
                                        .font(.system(size: 12, weight: .medium))
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .foregroundStyle(.white)
                            .padding(.top, 6)

                            if isSearching && (results.isEmpty || !isQueryEmpty) {
                                ProgressView("Searching the catalog…")
                                    .tint(Color.synAccent)
                                    .frame(maxWidth: .infinity, minHeight: 165)
                            } else if !isQueryEmpty, let searchError {
                                errorState(
                                    icon: "wifi.exclamationmark",
                                    title: "Search couldn't connect",
                                    message: searchError,
                                    action: "Try Again"
                                ) {
                                    retryToken += 1
                                }
                            } else if displayed.isEmpty {
                                if isQueryEmpty && app.isLoadingHome {
                                    ProgressView("Finding recommendations…")
                                        .tint(Color.synAccent)
                                        .frame(maxWidth: .infinity, minHeight: 160)
                                } else {
                                    errorState(
                                        icon: isQueryEmpty ? "sparkles.tv" : "magnifyingglass",
                                        title: isQueryEmpty ? "Discover something great" : "No matching titles",
                                        message: isQueryEmpty
                                            ? "Couldn't load picks right now. Check your connection and refresh."
                                            : "Try another title, or change the Films / Series filter.",
                                        action: isQueryEmpty ? "Refresh Picks" : "Clear Search"
                                    ) {
                                        if isQueryEmpty { Task { await app.loadHome() } }
                                        else { query = ""; scope = .all }
                                    }
                                }
                            } else {
                                ForEach(displayed) { media in
                                    resultRow(media)
                                }
                            }
                            Spacer(minLength: 110)
                        }
                        .padding(.horizontal, 18)
                        .frame(maxWidth: 950)
                        .frame(maxWidth: .infinity)
                    }
                    .scrollIndicators(.hidden)
                    .scrollDismissesKeyboard(.interactively)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .sheet(item: $selected) { media in DetailView(media: media).environmentObject(app) }
            .sheet(isPresented: $showList) { MyListView().environmentObject(app) }
            .sheet(isPresented: $showNew) { CivyNewAndHotView().environmentObject(app) }
            .task { if app.home == nil { await app.loadHome() } }
            .task(id: "\(cleanedQuery)|\(retryToken)") {
                guard !cleanedQuery.isEmpty else {
                    results = []
                    searchError = nil
                    isSearching = false
                    return
                }
                isSearching = true
                searchError = nil
                try? await Task.sleep(for: .milliseconds(300))
                guard !Task.isCancelled else { return }
                do {
                    let found = try await app.api.search(cleanedQuery)
                    guard !Task.isCancelled else { return }
                    results = found
                    searchError = nil
                } catch {
                    guard !Task.isCancelled else { return }
                    results = []
                    searchError = error.localizedDescription
                }
                isSearching = false
            }
            .accessibilityIdentifier("civy.flagshipSearch")
        }
    }

    private var header: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Search")
                    .font(.system(size: verticalSizeClass == .compact ? 25 : 32, weight: .bold))
                    .tracking(-0.9)
                Text("Find your next favorite")
                    .font(.system(size: 12))
                    .foregroundStyle(.white.opacity(0.55))
            }
            Spacer()
            CivyAirPlayControl()
            Button { showList = true } label: {
                Image(systemName: "bookmark")
                    .font(.system(size: 19, weight: .medium))
                    .frame(width: 44, height: 44)
                    .background(.white.opacity(0.06), in: Circle())
            }
            .accessibilityLabel("My List")
            Button { showNew = true } label: {
                Image(systemName: "bell")
                    .font(.system(size: 19, weight: .medium))
                    .frame(width: 44, height: 44)
                    .background(.white.opacity(0.06), in: Circle())
            }
            .accessibilityLabel("New and Hot")
        }
        .foregroundStyle(.white)
        .buttonStyle(.plain)
        .padding(.horizontal, 18)
        .padding(.top, verticalSizeClass == .compact ? 3 : 10)
        .padding(.bottom, 12)
    }

    private var searchField: some View {
        HStack(spacing: 11) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 19, weight: .medium))
                .foregroundStyle(Color.synAccent)
            TextField("Search movies and series", text: $query)
                .font(.system(size: 17))
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.search)
                .focused($searchFocused)
                .onSubmit {
                    saveSearch()
                    searchFocused = false
                }
                .accessibilityIdentifier("civy.search.input")
            if !query.isEmpty {
                Button {
                    query = ""
                    scope = .all
                    searchFocused = true
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 20))
                        .foregroundStyle(.white.opacity(0.6))
                        .frame(width: 36, height: 40)
                }
                .accessibilityLabel("Clear search")
            }
        }
        .foregroundStyle(.white)
        .padding(.leading, 16)
        .padding(.trailing, 8)
        .frame(height: 53)
        .background(Color.synSurface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(Color.synAccent.opacity(searchFocused ? 0.65 : 0.20),
                              lineWidth: searchFocused ? 1.5 : 0.8)
        }
        .padding(.horizontal, 18)
    }

    private var recentSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("Recent searches", systemImage: "clock.arrow.circlepath")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.86))
                Spacer()
                Button("Clear") { recentValue = "" }
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Color.synAccent)
                    .accessibilityLabel("Clear recent searches")
            }
            ScrollView(.horizontal) {
                HStack(spacing: 8) {
                    ForEach(recentQueries, id: \.self) { recent in
                        Button {
                            query = recent
                            searchFocused = false
                        } label: {
                            Text(recent)
                                .font(.system(size: 13, weight: .medium))
                                .lineLimit(1)
                                .padding(.horizontal, 14)
                                .frame(height: 36)
                                .background(.white.opacity(0.07), in: Capsule())
                                .overlay(Capsule().strokeBorder(.white.opacity(0.12)))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .scrollIndicators(.hidden)
        }
        .foregroundStyle(.white)
    }

    private func resultRow(_ media: Media) -> some View {
        HStack(spacing: 5) {
            Button {
                searchFocused = false
                saveSearch()
                selected = media
            } label: {
                HStack(spacing: 13) {
                    AsyncImage(url: media.backdropURL) { phase in
                        if let image = phase.image {
                            image.resizable().scaledToFill()
                        } else {
                            Rectangle().fill(Color.synElevated)
                                .overlay(Image(systemName: "film.stack").foregroundStyle(.white.opacity(0.32)))
                        }
                    }
                    .frame(width: verticalSizeClass == .compact ? 166 : 118,
                           height: verticalSizeClass == .compact ? 91 : 78)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    VStack(alignment: .leading, spacing: 6) {
                        Text(media.displayTitle)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(.white)
                            .multilineTextAlignment(.leading)
                            .lineLimit(2)
                        Text(media.kind == "tv" ? "Series" : "Film")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(Color.synPink.opacity(0.91))
                        if app.isFavorite(media) {
                            Label("In My List", systemImage: "checkmark")
                                .font(.system(size: 11))
                                .foregroundStyle(.white.opacity(0.64))
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    Spacer(minLength: 0)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("View \(media.displayTitle) details")
            Button {
                searchFocused = false
                saveSearch()
                play(media)
            } label: {
                Image(systemName: "play.fill")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 44, height: 44)
                    .background(Color.synAccent.opacity(0.92), in: Circle())
            }
            .buttonStyle(.plain)
            .padding(.trailing, 12)
            .accessibilityLabel("Play \(media.displayTitle)")
        }
        .padding(.leading, 9)
        .padding(.vertical, 8)
        .background(Color.synSurface.opacity(0.75), in: RoundedRectangle(cornerRadius: 17))
        .overlay(RoundedRectangle(cornerRadius: 17).strokeBorder(.white.opacity(0.08), lineWidth: 0.7))
    }

    private func errorState(icon: String, title: String, message: String,
                            action: String, retry: @escaping () -> Void) -> some View {
        VStack(spacing: 13) {
            Image(systemName: icon)
                .font(.system(size: 31, weight: .light))
                .foregroundStyle(Color.synAccent)
                .frame(width: 68, height: 68)
                .background(Color.synAccent.opacity(0.10), in: Circle())
            Text(title)
                .font(.system(size: 19, weight: .semibold))
                .foregroundStyle(.white)
            Text(message)
                .font(.system(size: 14))
                .foregroundStyle(.white.opacity(0.62))
                .multilineTextAlignment(.center)
            Button(action, action: retry)
                .buttonStyle(.borderedProminent)
                .tint(Color.synAccent)
                .padding(.top, 5)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 24)
        .padding(.vertical, 48)
    }

    private func saveSearch() {
        let value = String(cleanedQuery.replacingOccurrences(of: "\n", with: " ").prefix(72))
        guard !value.isEmpty else { return }
        var list = recentQueries.filter { $0.localizedCaseInsensitiveCompare(value) != .orderedSame }
        list.insert(value, at: 0)
        recentValue = list.prefix(6).joined(separator: "\n")
    }

    private func play(_ media: Media) {
        let saved = app.progress(for: media)
        app.play(media, season: media.kind == "tv" ? (saved?.season ?? 1) : nil,
                 episode: media.kind == "tv" ? (saved?.episode ?? 1) : nil)
    }
}


struct MyListView: View {
    @EnvironmentObject var app: AppState
    @State private var selected: Media?
    @Environment(\.verticalSizeClass) private var verticalSizeClass
    private var columns: [GridItem] {
        Array(repeating: GridItem(.flexible(), spacing: 13), count: verticalSizeClass == .compact ? 5 : 3)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.synBackground.ignoresSafeArea()
                ScrollView {
                    if app.favorites.isEmpty {
                        EmptyState(symbol: "bookmark", title: "Your collection starts here", subtitle: "Tap + on any title to keep it close.")
                    } else {
                        LazyVGrid(columns: columns, spacing: 18) {
                            ForEach(app.favorites) { media in
                                MediaCard(media: media, width: verticalSizeClass == .compact ? 136 : 105) { selected = $0 }
                                    .frame(maxWidth: .infinity)
                            }
                        }
                        .padding(.horizontal, 18).padding(.top, 18).padding(.bottom, 110)
                    }
                }
            }
            .navigationTitle("My List")
            .sheet(item: $selected) { media in DetailView(media: media).environmentObject(app) }
        }
    }
}