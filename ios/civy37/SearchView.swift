import SwiftUI

// Screenshot-matched search: cinematic landscape thumbnails and immediate play actions.
struct SearchView: View {
    @EnvironmentObject private var app: AppState
    @State private var query = ""
    @State private var results: [Media] = []
    @State private var isSearching = false
    @State private var searchError: String?
    @State private var selected: Media?
    @State private var showDownloads = false
    @State private var showNew = false

    private var isQueryEmpty: Bool { query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    private var recommended: [Media] {
        guard let home = app.home else { return [] }
        var seen = Set<String>()
        return (home.trending + home.popularTv + home.popularMovies + home.topRatedMovies)
            .filter { ($0.backdropPath != nil || $0.posterPath != nil) && seen.insert($0.key).inserted }
            .prefix(28).map { $0 }
    }
    private var displayed: [Media] { isQueryEmpty ? recommended : results }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()
                VStack(spacing: 0) {
                    HStack(spacing: 9) {
                        Text("Search")
                            .font(.system(size: 32, weight: .bold))
                            .tracking(-0.8)
                        Spacer(minLength: 8)
                        CivyAirPlayControl()
                        Button { showDownloads = true } label: {
                            Image(systemName: "arrow.down.to.line")
                                .font(.system(size: 24, weight: .medium))
                                .frame(width: 42, height: 44)
                        }
                        .accessibilityLabel("Downloads")
                        Button { showNew = true } label: {
                            Image(systemName: "bell")
                                .font(.system(size: 24, weight: .medium))
                                .frame(width: 42, height: 44)
                        }
                        .accessibilityLabel("New and Hot")
                    }
                    .foregroundStyle(.white)
                    .buttonStyle(.plain)
                    .padding(.horizontal, 16)
                    .padding(.top, 5)
                    .frame(height: 55)

                    HStack(spacing: 13) {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 21, weight: .regular))
                            .foregroundStyle(.white.opacity(0.66))
                        TextField("Search series, films, games...", text: $query)
                            .font(.system(size: 17))
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .submitLabel(.search)
                            .accessibilityLabel("Search series and films")
                        if !query.isEmpty {
                            Button { query = "" } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundStyle(.white.opacity(0.6))
                            }.accessibilityLabel("Clear search")
                        }
                    }
                    .padding(.horizontal, 16)
                    .frame(height: 53)
                    .background(Color(white: 0.075), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(.white.opacity(0.14), lineWidth: 0.8))
                    .padding(.horizontal, 16)
                    .padding(.top, 10)
                    .padding(.bottom, 17)

                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 9) {
                            Text(isQueryEmpty ? "Recommended series & films" : "Search results")
                                .font(.system(size: 23, weight: .bold))
                                .tracking(-0.65)
                                .foregroundStyle(.white)
                                .padding(.bottom, 7)
                            if isQueryEmpty && recommended.isEmpty {
                                ProgressView("Loading recommendations…")
                                    .tint(.white).frame(maxWidth: .infinity).padding(.top, 50)
                            } else if isSearching && results.isEmpty {
                                ProgressView("Searching…")
                                    .tint(.white).frame(maxWidth: .infinity).padding(.top, 50)
                            } else if let searchError, !isQueryEmpty {
                                VStack(alignment: .leading, spacing: 10) {
                                    Text("Search unavailable").font(.headline)
                                    Text(searchError).foregroundStyle(.white.opacity(0.6))
                                }.padding(.top, 32)
                            } else if displayed.isEmpty {
                                Text("No matching films or series found.")
                                    .foregroundStyle(.secondary).padding(.top, 35)
                            } else {
                                ForEach(displayed) { media in
                                    HStack(spacing: 14) {
                                        Button { selected = media } label: {
                                            AsyncImage(url: media.backdropURL) { phase in
                                                if let image = phase.image {
                                                    image.resizable().scaledToFill()
                                                } else {
                                                    Rectangle().fill(Color.synSurface)
                                                        .overlay(Image(systemName: "film").foregroundStyle(.white.opacity(0.2)))
                                                }
                                            }
                                            .frame(width: 150, height: 86)
                                            .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))
                                        }
                                        .buttonStyle(.plain)
                                        Button { selected = media } label: {
                                            Text(media.displayTitle)
                                                .font(.system(size: 17, weight: .medium))
                                                .foregroundStyle(.white)
                                                .multilineTextAlignment(.leading)
                                                .lineLimit(2)
                                                .frame(maxWidth: .infinity, alignment: .leading)
                                        }.buttonStyle(.plain)
                                        Button { play(media) } label: {
                                            Image(systemName: "play.circle")
                                                .font(.system(size: 37, weight: .ultraLight))
                                                .foregroundStyle(.white)
                                                .frame(width: 46, height: 50)
                                        }
                                        .buttonStyle(.plain)
                                        .accessibilityLabel("Play \(media.displayTitle)")
                                    }
                                    .frame(height: 90)
                                    .contentShape(Rectangle())
                                    .accessibilityElement(children: .contain)
                                }
                            }
                            Spacer(minLength: 105)
                        }
                        .padding(.horizontal, 16)
                    }
                    .scrollIndicators(.hidden)
                    .scrollDismissesKeyboard(.interactively)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .sheet(item: $selected) { media in DetailView(media: media).environmentObject(app) }
            .sheet(isPresented: $showDownloads) { CivyDownloadsView().environmentObject(app) }
            .sheet(isPresented: $showNew) { CivyNewAndHotView().environmentObject(app) }
            .task { if app.home == nil { await app.loadHome() } }
            .task(id: query) {
                guard !isQueryEmpty else { results = []; searchError = nil; isSearching = false; return }
                isSearching = true
                try? await Task.sleep(for: .milliseconds(300))
                guard !Task.isCancelled else { return }
                do {
                    let found = try await app.api.search(query)
                    guard !Task.isCancelled else { return }
                    results = found
                    searchError = nil
                } catch {
                    guard !Task.isCancelled else { return }
                    searchError = error.localizedDescription
                    results = []
                }
                isSearching = false
            }
        }
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
    private let columns = [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]

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
                                MediaCard(media: media, width: 105) { selected = $0 }
                                    .frame(maxWidth: .infinity)
                            }
                        }
                        .padding(.horizontal, 18).padding(.top, 14)
                    }
                }
            }
            .navigationTitle("My List")
            .sheet(item: $selected) { media in DetailView(media: media).environmentObject(app) }
        }
    }
}