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
        GeometryReader { geometry in
            let isPad = UIDevice.current.userInterfaceIdiom == .pad && geometry.size.width >= 760
            let edge = isPad ? max(30, min(46, geometry.size.width * 0.034)) : 18

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 20) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Settings")
                            .font(.system(size: isPad ? 34 : 31, weight: .heavy))
                            .tracking(-1.0)
                        Text("Appearance and playback")
                            .font(.system(size: 12.5, weight: .medium))
                            .foregroundStyle(.white.opacity(0.40))
                    }

                    if isPad {
                        HStack(alignment: .top, spacing: 18) {
                            appearancePanel
                                .frame(maxWidth: .infinity)

                            VStack(spacing: 18) {
                                playbackPanel
                                aboutPanel
                            }
                            .frame(width: min(360, geometry.size.width * 0.34))
                        }
                    } else {
                        appearancePanel
                        playbackPanel
                        aboutPanel
                    }

                    Spacer(minLength: 72)
                }
                .padding(.horizontal, edge)
                .padding(.top, 8)
            }
            .background(Color.black)
        }
    }

    private var appearancePanel: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Appearance")
                        .font(.system(size: 17, weight: .bold))
                    Text("Choose the accent used by native Liquid Glass controls.")
                        .font(.system(size: 11.5))
                        .foregroundStyle(.white.opacity(0.42))
                }
                Spacer()
                SynFlixBrandMark(size: 36)
            }

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 72), spacing: 12)], spacing: 14) {
                ForEach(SynFlixTheme.allCases) { choice in
                    Button {
                        theme.theme = choice
                    } label: {
                        VStack(spacing: 7) {
                            ZStack {
                                Circle()
                                    .fill(choice.accent)
                                    .frame(width: 36, height: 36)
                                if theme.theme == choice {
                                    Image(systemName: "checkmark")
                                        .font(.system(size: 12.5, weight: .black))
                                        .foregroundStyle(choice == .monochrome || choice == .noir || choice == .synflix ? .black : .white)
                                }
                            }
                            Text(choice.name)
                                .font(.system(size: 10.25, weight: .semibold))
                                .foregroundStyle(theme.theme == choice ? .white : .white.opacity(0.46))
                                .lineLimit(1)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }

            Divider().overlay(.white.opacity(0.06))
            settingToggle(title: "Haptics", subtitle: "Feedback on important controls", isOn: $theme.hapticsEnabled)
            settingToggle(title: "Reduce motion", subtitle: "Use quieter transitions", isOn: $theme.reducedMotion)
        }
        .padding(20)
        .background(Color.white.opacity(0.022), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(.white.opacity(0.055), lineWidth: 0.6)
        }
    }

    private var playbackPanel: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Playback")
                .font(.system(size: 17, weight: .bold))
            settingToggle(title: "Autoplay", subtitle: "Start when a source is ready", isOn: $theme.autoplayEnabled)

            HStack(spacing: 11) {
                Image(systemName: "play.rectangle.on.rectangle.fill")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(theme.accent)
                    .frame(width: 28)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Native playback")
                        .font(.system(size: 13.5, weight: .semibold))
                    Text("AVPlayer · AirPlay · Picture in Picture")
                        .font(.system(size: 11))
                        .foregroundStyle(.white.opacity(0.42))
                }
                Spacer()
            }
        }
        .padding(20)
        .background(Color.white.opacity(0.022), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(.white.opacity(0.055), lineWidth: 0.6)
        }
    }

    private var aboutPanel: some View {
        HStack(spacing: 13) {
            SynFlixBrandMark(size: 40)
            VStack(alignment: .leading, spacing: 3) {
                Text("SynFlix")
                    .font(.system(size: 14.5, weight: .bold))
                Text("Version 1.6 · iPhone and iPad")
                    .font(.system(size: 11))
                    .foregroundStyle(.white.opacity(0.42))
            }
            Spacer()
        }
        .padding(18)
        .background(Color.white.opacity(0.022), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(.white.opacity(0.055), lineWidth: 0.6)
        }
    }

    private func settingToggle(title: String, subtitle: String, isOn: Binding<Bool>) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 13.5, weight: .semibold))
                Text(subtitle)
                    .font(.system(size: 11))
                    .foregroundStyle(.white.opacity(0.42))
            }
            Spacer()
            Toggle("", isOn: isOn)
                .labelsHidden()
                .tint(theme.accent)
        }
    }
}
