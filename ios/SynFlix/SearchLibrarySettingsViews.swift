import SwiftUI
import UIKit

struct SearchView: View {
    @EnvironmentObject private var theme: ThemeStore
    @EnvironmentObject private var router: AppRouter

    @State private var query = ""
    @State private var results: [MediaItem] = []
    @State private var trending: [MediaItem] = []
    @State private var isSearching = false
    @State private var errorMessage: String?
    @State private var filter = "all"
    @FocusState private var searchFocused: Bool

    private var filtered: [MediaItem] {
        guard filter != "all" else { return results }
        return results.filter { $0.kind == filter }
    }

    var body: some View {
        GeometryReader { geometry in
            let isPad = UIDevice.current.userInterfaceIdiom == .pad
            let edge = isPad ? max(28, min(44, geometry.size.width * 0.032)) : 18
            let gridMinimum: CGFloat = isPad ? 146 : 116

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 22) {
                    VStack(alignment: .leading, spacing: 14) {
                        Text("Search")
                            .font(.system(size: isPad ? 34 : 31, weight: .heavy))
                            .tracking(-1.0)

                        HStack(spacing: 10) {
                            Image(systemName: "magnifyingglass")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(.white.opacity(0.45))

                            TextField("Search movies and series", text: $query)
                                .focused($searchFocused)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .font(.system(size: 16, weight: .medium))
                                .foregroundStyle(.white)
                                .submitLabel(.search)

                            if !query.isEmpty {
                                Button {
                                    query = ""
                                    results = []
                                } label: {
                                    Image(systemName: "xmark.circle.fill")
                                        .foregroundStyle(.white.opacity(0.34))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, 16)
                        .frame(height: 50)
                        .frame(maxWidth: isPad ? 720 : .infinity)
                        .synflixGlass(tint: theme.accent.opacity(searchFocused ? 0.07 : 0.025), cornerRadius: 14, interactive: true)

                        if !results.isEmpty {
                            HStack(spacing: 8) {
                                filterButton("All", value: "all")
                                filterButton("Movies", value: "movie")
                                filterButton("Series", value: "tv")
                            }
                        }
                    }
                    .padding(.horizontal, edge)

                    if isSearching {
                        ProgressView()
                            .tint(theme.accent)
                            .frame(maxWidth: .infinity)
                            .padding(.top, 24)
                    } else if let errorMessage, !query.isEmpty {
                        ErrorPanel(title: "Search failed", message: errorMessage) {
                            Task { await performSearch(query) }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.horizontal, edge)
                    } else if query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Trending")
                                .font(.system(size: 19, weight: .bold))
                                .tracking(-0.4)
                                .padding(.horizontal, edge)
                            mediaGrid(trending, minimum: gridMinimum, edge: edge)
                        }
                    } else if filtered.isEmpty {
                        VStack(spacing: 10) {
                            Image(systemName: "magnifyingglass")
                                .font(.system(size: 28, weight: .medium))
                                .foregroundStyle(theme.accent.opacity(0.70))
                            Text("No matches")
                                .font(.system(size: 18, weight: .bold))
                            Text("Try a different title or filter.")
                                .font(.system(size: 13))
                                .foregroundStyle(.white.opacity(0.42))
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.top, 54)
                    } else {
                        mediaGrid(filtered, minimum: gridMinimum, edge: edge)
                    }

                    Spacer(minLength: 72)
                }
                .padding(.top, 8)
            }
            .background(Color.black)
        }
        .task {
            if trending.isEmpty,
               let home = try? await SynFlixAPI.shared.home() {
                await MainActor.run { trending = Array((home.trending ?? []).prefix(24)) }
            }
        }
        .task(id: query) {
            let clean = query.trimmingCharacters(in: .whitespacesAndNewlines)
            guard clean.count >= 2 else {
                await MainActor.run {
                    results = []
                    isSearching = false
                    errorMessage = nil
                }
                return
            }
            try? await Task.sleep(nanoseconds: 260_000_000)
            guard !Task.isCancelled else { return }
            await performSearch(clean)
        }
    }

    private func filterButton(_ title: String, value: String) -> some View {
        Button {
            filter = value
            theme.impact()
        } label: {
            Text(title)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(filter == value ? .black : .white.opacity(0.68))
                .padding(.horizontal, 13)
                .frame(height: 32)
                .background(filter == value ? theme.accent : Color.white.opacity(0.045), in: RoundedRectangle(cornerRadius: 9, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private func mediaGrid(_ items: [MediaItem], minimum: CGFloat, edge: CGFloat) -> some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: minimum), spacing: 14)], spacing: 18) {
            ForEach(items) { item in
                Button {
                    router.open(item)
                } label: {
                    VStack(alignment: .leading, spacing: 7) {
                        ArtworkView(url: item.posterURL, cornerRadius: 8)
                            .aspectRatio(2.0 / 3.0, contentMode: .fit)
                            .overlay {
                                RoundedRectangle(cornerRadius: 8, style: .continuous)
                                    .stroke(.white.opacity(0.05), lineWidth: 0.6)
                            }
                        Text(item.displayTitle)
                            .font(.system(size: 12.5, weight: .semibold))
                            .foregroundStyle(.white.opacity(0.88))
                            .lineLimit(1)
                    }
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, edge)
    }

    private func performSearch(_ text: String) async {
        await MainActor.run {
            isSearching = true
            errorMessage = nil
        }
        do {
            let found = try await SynFlixAPI.shared.search(text)
            guard !Task.isCancelled else { return }
            await MainActor.run {
                results = found
                isSearching = false
            }
        } catch {
            guard !Task.isCancelled else { return }
            await MainActor.run {
                errorMessage = error.localizedDescription
                isSearching = false
            }
        }
    }
}

struct LibraryView: View {
    @EnvironmentObject private var theme: ThemeStore
    @EnvironmentObject private var library: LibraryStore
    @EnvironmentObject private var router: AppRouter

    var body: some View {
        GeometryReader { geometry in
            let isPad = UIDevice.current.userInterfaceIdiom == .pad
            let edge = isPad ? max(28, min(44, geometry.size.width * 0.032)) : 18
            let minimum: CGFloat = isPad ? 146 : 116

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 22) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("My List")
                            .font(.system(size: isPad ? 34 : 31, weight: .heavy))
                            .tracking(-1.0)
                        Text(library.items.isEmpty ? "Save titles to watch later." : "\(library.items.count) saved \(library.items.count == 1 ? "title" : "titles")")
                            .font(.system(size: 12.5, weight: .medium))
                            .foregroundStyle(.white.opacity(0.40))
                    }
                    .padding(.horizontal, edge)

                    if library.items.isEmpty {
                        VStack(spacing: 13) {
                            Image(systemName: "bookmark")
                                .font(.system(size: 29, weight: .medium))
                                .foregroundStyle(theme.accent)
                            Text("Nothing saved yet")
                                .font(.system(size: 18, weight: .bold))
                            Text("Add a movie or series and it will show up here.")
                                .font(.system(size: 13))
                                .foregroundStyle(.white.opacity(0.42))
                                .multilineTextAlignment(.center)
                        }
                        .padding(28)
                        .frame(maxWidth: 420)
                        .background(Color.white.opacity(0.025), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .stroke(.white.opacity(0.055), lineWidth: 0.6)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.top, 50)
                        .padding(.horizontal, edge)
                    } else {
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: minimum), spacing: 14)], spacing: 18) {
                            ForEach(library.items) { item in
                                Button {
                                    router.open(item)
                                } label: {
                                    VStack(alignment: .leading, spacing: 7) {
                                        ArtworkView(url: item.posterURL, cornerRadius: 8)
                                            .aspectRatio(2.0 / 3.0, contentMode: .fit)
                                            .overlay(alignment: .topTrailing) {
                                                Button {
                                                    library.toggle(item, haptics: theme.hapticsEnabled)
                                                } label: {
                                                    Image(systemName: "xmark")
                                                        .font(.system(size: 10.5, weight: .bold))
                                                        .foregroundStyle(.white)
                                                        .frame(width: 29, height: 29)
                                                }
                                                .buttonStyle(.plain)
                                                .synflixCircleGlass(tint: .black.opacity(0.18))
                                                .padding(7)
                                            }
                                        Text(item.displayTitle)
                                            .font(.system(size: 12.5, weight: .semibold))
                                            .foregroundStyle(.white.opacity(0.88))
                                            .lineLimit(1)
                                    }
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, edge)
                    }

                    Spacer(minLength: 72)
                }
                .padding(.top, 8)
            }
            .background(Color.black)
        }
    }
}

struct SettingsView: View {
    @EnvironmentObject private var theme: ThemeStore

    var body: some View {
        List {
            Section {
                Picker(selection: $theme.theme) {
                    ForEach(SynFlixTheme.allCases) { choice in
                        Label {
                            Text(choice.name)
                        } icon: {
                            Circle()
                                .fill(choice.accent)
                                .frame(width: 10, height: 10)
                        }
                        .tag(choice)
                    }
                } label: {
                    Label("Theme", systemImage: "paintpalette.fill")
                }
                .pickerStyle(.menu)
                .tint(theme.accent)

                HStack(spacing: 12) {
                    Label("Accent", systemImage: "circle.lefthalf.filled")
                    Spacer()
                    Circle()
                        .fill(theme.accent)
                        .frame(width: 18, height: 18)
                        .overlay(Circle().stroke(.white.opacity(0.22), lineWidth: 0.7))
                    Text(theme.theme.name)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(.white.opacity(0.55))
                }
            } header: {
                Text("Appearance")
            }

            Section {
                Toggle(isOn: $theme.autoplayEnabled) {
                    Label("Autoplay", systemImage: "play.fill")
                }
                .tint(theme.accent)

                HStack(spacing: 12) {
                    Label("Player", systemImage: "play.rectangle.on.rectangle.fill")
                    Spacer()
                    Text("Native")
                        .foregroundStyle(.white.opacity(0.48))
                }

                HStack(spacing: 12) {
                    Label("External playback", systemImage: "airplayvideo")
                    Spacer()
                    Text("AirPlay + PiP")
                        .foregroundStyle(.white.opacity(0.48))
                }
            } header: {
                Text("Playback")
            }

            Section {
                Toggle(isOn: $theme.hapticsEnabled) {
                    Label("Haptics", systemImage: "hand.tap.fill")
                }
                .tint(theme.accent)

                Toggle(isOn: $theme.reducedMotion) {
                    Label("Reduce Motion", systemImage: "figure.walk.motion")
                }
                .tint(theme.accent)
            } header: {
                Text("Interface")
            }

            Section {
                HStack(spacing: 12) {
                    SynFlixBrandMark(size: 32)
                    Text("SynFlix")
                        .font(.system(size: 15, weight: .semibold))
                    Spacer()
                    Text("1.9")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(.white.opacity(0.45))
                }

                HStack(spacing: 12) {
                    Label("Device", systemImage: "ipad.and.iphone")
                    Spacer()
                    Text(UIDevice.current.userInterfaceIdiom == .pad ? "iPad" : "iPhone")
                        .foregroundStyle(.white.opacity(0.48))
                }
            } header: {
                Text("About")
            }
        }
        .environment(\.defaultMinListRowHeight, 48)
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Color.black)
        .foregroundStyle(.white.opacity(0.90))
        .tint(theme.accent)
    }
}
