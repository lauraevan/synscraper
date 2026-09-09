import SwiftUI

struct SearchView: View {
    @EnvironmentObject private var theme: ThemeStore
    @EnvironmentObject private var router: AppRouter
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

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
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 14) {
                    Text("Search")
                        .font(.system(size: horizontalSizeClass == .regular ? 42 : 34, weight: .heavy))
                        .tracking(-1.2)

                    HStack(spacing: 10) {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(.white.opacity(0.46))

                        TextField("Movies, series, people", text: $query)
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
                    .frame(height: 52)
                    .synflixGlass(tint: theme.accent.opacity(searchFocused ? 0.085 : 0.035), cornerRadius: 18, interactive: true)

                    if !results.isEmpty {
                        HStack(spacing: 8) {
                            filterButton("All", value: "all")
                            filterButton("Movies", value: "movie")
                            filterButton("Series", value: "tv")
                        }
                    }
                }
                .padding(.horizontal, horizontalSizeClass == .regular ? 28 : 18)

                if isSearching {
                    HStack {
                        Spacer()
                        ProgressView().tint(theme.accent)
                        Spacer()
                    }
                    .padding(.top, 20)
                } else if let errorMessage, !query.isEmpty {
                    ErrorPanel(title: "Search failed", message: errorMessage) {
                        Task { await performSearch(query) }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, 20)
                } else if query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Trending searches")
                            .font(.system(size: 19, weight: .bold))
                            .tracking(-0.4)
                            .padding(.horizontal, horizontalSizeClass == .regular ? 28 : 18)

                        mediaGrid(trending)
                    }
                } else if filtered.isEmpty {
                    VStack(spacing: 10) {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 28, weight: .medium))
                            .foregroundStyle(theme.accent.opacity(0.72))
                        Text("No matches")
                            .font(.system(size: 18, weight: .bold))
                        Text("Try another title or switch the filter.")
                            .font(.system(size: 13))
                            .foregroundStyle(.white.opacity(0.42))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, 48)
                } else {
                    mediaGrid(filtered)
                }

                Spacer(minLength: 100)
            }
            .padding(.top, 8)
        }
        .background(Color.black)
        .task {
            if trending.isEmpty,
               let home = try? await SynFlixAPI.shared.home() {
                await MainActor.run { trending = Array((home.trending ?? []).prefix(18)) }
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
            try? await Task.sleep(nanoseconds: 320_000_000)
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
                .foregroundStyle(filter == value ? .black : .white.opacity(0.72))
                .padding(.horizontal, 14)
                .frame(height: 34)
                .background(filter == value ? theme.accent : Color.clear, in: Capsule())
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .synflixGlass(tint: filter == value ? nil : theme.accent.opacity(0.025), cornerRadius: 17, interactive: true)
    }

    private func mediaGrid(_ items: [MediaItem]) -> some View {
        let minimum: CGFloat = horizontalSizeClass == .regular ? 164 : 118
        return LazyVGrid(columns: [GridItem(.adaptive(minimum: minimum), spacing: 13)], spacing: 18) {
            ForEach(items) { item in
                Button {
                    router.open(item)
                } label: {
                    VStack(alignment: .leading, spacing: 7) {
                        ArtworkView(url: item.posterURL, cornerRadius: 10)
                            .aspectRatio(2.0 / 3.0, contentMode: .fit)
                            .overlay {
                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                    .stroke(.white.opacity(0.06), lineWidth: 0.6)
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
        .padding(.horizontal, horizontalSizeClass == .regular ? 28 : 18)
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
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 5) {
                    Text("My List")
                        .font(.system(size: horizontalSizeClass == .regular ? 42 : 34, weight: .heavy))
                        .tracking(-1.2)
                    Text(library.items.isEmpty ? "Save something worth coming back to." : "\(library.items.count) saved \(library.items.count == 1 ? "title" : "titles")")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(.white.opacity(0.40))
                }
                .padding(.horizontal, horizontalSizeClass == .regular ? 28 : 18)

                if library.items.isEmpty {
                    VStack(spacing: 14) {
                        SynFlixBrandMark(size: 52)
                        Text("Your list is empty")
                            .font(.system(size: 19, weight: .bold))
                        Text("Tap + on a movie or series and it'll live here.")
                            .font(.system(size: 13))
                            .foregroundStyle(.white.opacity(0.43))
                            .multilineTextAlignment(.center)
                    }
                    .padding(26)
                    .frame(maxWidth: 390)
                    .synflixGlass(tint: theme.accent.opacity(0.045), cornerRadius: 26)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 44)
                    .padding(.horizontal, 20)
                } else {
                    let minimum: CGFloat = horizontalSizeClass == .regular ? 164 : 118
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: minimum), spacing: 13)], spacing: 18) {
                        ForEach(library.items) { item in
                            Button {
                                router.open(item)
                            } label: {
                                VStack(alignment: .leading, spacing: 7) {
                                    ArtworkView(url: item.posterURL, cornerRadius: 10)
                                        .aspectRatio(2.0 / 3.0, contentMode: .fit)
                                        .overlay(alignment: .topTrailing) {
                                            Button {
                                                library.toggle(item, haptics: theme.hapticsEnabled)
                                            } label: {
                                                Image(systemName: "minus")
                                                    .font(.system(size: 11, weight: .bold))
                                                    .foregroundStyle(.white)
                                                    .frame(width: 30, height: 30)
                                            }
                                            .buttonStyle(.plain)
                                            .synflixCircleGlass(tint: .black.opacity(0.16))
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
                    .padding(.horizontal, horizontalSizeClass == .regular ? 28 : 18)
                }

                Spacer(minLength: 100)
            }
            .padding(.top, 8)
        }
        .background(Color.black)
    }
}

struct SettingsView: View {
    @EnvironmentObject private var theme: ThemeStore
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 22) {
                VStack(alignment: .leading, spacing: 5) {
                    Text("Settings")
                        .font(.system(size: horizontalSizeClass == .regular ? 42 : 34, weight: .heavy))
                        .tracking(-1.2)
                    Text("Make SynFlix feel like yours.")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(.white.opacity(0.40))
                }

                appearancePanel
                playbackPanel
                aboutPanel
                Spacer(minLength: 100)
            }
            .padding(.horizontal, horizontalSizeClass == .regular ? 28 : 18)
            .padding(.top, 8)
        }
        .background(Color.black)
    }

    private var appearancePanel: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Appearance")
                        .font(.system(size: 18, weight: .bold))
                    Text("Theme the glass, controls, and playback accents.")
                        .font(.system(size: 12))
                        .foregroundStyle(.white.opacity(0.42))
                }
                Spacer()
                SynFlixBrandMark(size: 38)
            }

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 74), spacing: 12)], spacing: 14) {
                ForEach(SynFlixTheme.allCases) { choice in
                    Button {
                        theme.theme = choice
                    } label: {
                        VStack(spacing: 8) {
                            ZStack {
                                Circle()
                                    .fill(choice.accent)
                                    .frame(width: 38, height: 38)
                                if theme.theme == choice {
                                    Image(systemName: "checkmark")
                                        .font(.system(size: 13, weight: .black))
                                        .foregroundStyle(choice == .monochrome || choice == .noir || choice == .synflix ? .black : .white)
                                }
                            }
                            Text(choice.name)
                                .font(.system(size: 10.5, weight: .semibold))
                                .foregroundStyle(theme.theme == choice ? .white : .white.opacity(0.48))
                                .lineLimit(1)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }

            Divider().overlay(.white.opacity(0.06))

            settingToggle(title: "Haptics", subtitle: "Physical feedback on important controls", isOn: $theme.hapticsEnabled)
            settingToggle(title: "Reduce motion", subtitle: "Use quieter transitions throughout the client", isOn: $theme.reducedMotion)
        }
        .padding(20)
        .synflixGlass(tint: theme.accent.opacity(0.045), cornerRadius: 26)
    }

    private var playbackPanel: some View {
        VStack(alignment: .leading, spacing: 17) {
            Text("Playback")
                .font(.system(size: 18, weight: .bold))
            settingToggle(title: "Autoplay", subtitle: "Start playback as soon as a source is ready", isOn: $theme.autoplayEnabled)

            HStack(spacing: 12) {
                Image(systemName: "play.rectangle.on.rectangle.fill")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(theme.accent)
                    .frame(width: 30)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Native player")
                        .font(.system(size: 14, weight: .semibold))
                    Text("AVPlayer, AirPlay, Picture in Picture, and source switching")
                        .font(.system(size: 11.5))
                        .foregroundStyle(.white.opacity(0.42))
                }
                Spacer()
                Text("ON")
                    .font(.system(size: 10, weight: .bold))
                    .tracking(0.8)
                    .foregroundStyle(theme.accent)
            }
        }
        .padding(20)
        .synflixGlass(tint: theme.accent.opacity(0.028), cornerRadius: 26)
    }

    private var aboutPanel: some View {
        HStack(spacing: 14) {
            SynFlixBrandMark(size: 44)
            VStack(alignment: .leading, spacing: 3) {
                Text("SynFlix Native")
                    .font(.system(size: 15, weight: .bold))
                Text("Version 1.5 · built for iPhone and iPad")
                    .font(.system(size: 11.5))
                    .foregroundStyle(.white.opacity(0.42))
            }
            Spacer()
            Text("PREMIUM")
                .font(.system(size: 9.5, weight: .black))
                .tracking(1.1)
                .foregroundStyle(theme.accent)
        }
        .padding(18)
        .synflixGlass(tint: theme.accent.opacity(0.035), cornerRadius: 22)
    }

    private func settingToggle(title: String, subtitle: String, isOn: Binding<Bool>) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 14, weight: .semibold))
                Text(subtitle)
                    .font(.system(size: 11.5))
                    .foregroundStyle(.white.opacity(0.42))
            }
            Spacer()
            Toggle("", isOn: isOn)
                .labelsHidden()
                .tint(theme.accent)
        }
    }
}
