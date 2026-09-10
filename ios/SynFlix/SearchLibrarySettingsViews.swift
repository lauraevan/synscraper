import SwiftUI
import UIKit
import Foundation

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
            let wide = geometry.size.width >= 700
            let edge = wide ? max(24, min(40, geometry.size.width * 0.03)) : 18
            let gridMinimum: CGFloat = wide ? 138 : 116

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: wide ? 18 : 21) {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Search")
                            .font(.system(size: wide ? 29 : 31, weight: .bold))
                            .tracking(-0.9)

                        HStack(spacing: 10) {
                            Image(systemName: "magnifyingglass")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(.white.opacity(0.44))

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
                                        .foregroundStyle(.white.opacity(0.32))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, 15)
                        .frame(height: 46)
                        .frame(maxWidth: wide ? 660 : .infinity)
                        .background(Color.white.opacity(0.045), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .stroke(searchFocused ? theme.accent.opacity(0.42) : .white.opacity(0.07), lineWidth: 0.7)
                        }

                        if !results.isEmpty {
                            HStack(spacing: 7) {
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
                            .padding(.top, 20)
                    } else if let errorMessage, !query.isEmpty {
                        ErrorPanel(title: "Search failed", message: errorMessage) {
                            Task { await performSearch(query) }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.horizontal, edge)
                    } else if query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        VStack(alignment: .leading, spacing: 11) {
                            Text("Trending")
                                .font(.system(size: 18, weight: .bold))
                                .tracking(-0.35)
                                .padding(.horizontal, edge)
                            mediaGrid(trending, minimum: gridMinimum, edge: edge, wide: wide)
                        }
                    } else if filtered.isEmpty {
                        VStack(spacing: 9) {
                            Image(systemName: "magnifyingglass")
                                .font(.system(size: 26, weight: .medium))
                                .foregroundStyle(theme.accent.opacity(0.72))
                            Text("No matches")
                                .font(.system(size: 17, weight: .bold))
                            Text("Try another title or filter.")
                                .font(.system(size: 12.5))
                                .foregroundStyle(.white.opacity(0.40))
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.top, 48)
                    } else {
                        mediaGrid(filtered, minimum: gridMinimum, edge: edge, wide: wide)
                    }

                    Spacer(minLength: wide ? 34 : 70)
                }
                .padding(.top, wide ? 14 : 8)
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
            try? await Task.sleep(nanoseconds: 220_000_000)
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
                .font(.system(size: 11.5, weight: .semibold))
                .foregroundStyle(filter == value ? .black : .white.opacity(0.66))
                .padding(.horizontal, 12)
                .frame(height: 30)
                .background(filter == value ? theme.accent : Color.white.opacity(0.042), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private func mediaGrid(_ items: [MediaItem], minimum: CGFloat, edge: CGFloat, wide: Bool) -> some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: minimum), spacing: wide ? 12 : 14)], spacing: wide ? 16 : 18) {
            ForEach(items) { item in
                Button {
                    router.open(item)
                } label: {
                    VStack(alignment: .leading, spacing: 6) {
                        ArtworkView(url: item.posterURL, cornerRadius: 7)
                            .aspectRatio(2.0 / 3.0, contentMode: .fit)
                            .overlay {
                                RoundedRectangle(cornerRadius: 7, style: .continuous)
                                    .stroke(.white.opacity(0.045), lineWidth: 0.55)
                            }
                        Text(item.displayTitle)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(.white.opacity(0.87))
                            .lineLimit(1)
                    }
                }
                .buttonStyle(.plain)
                .hoverEffect(.highlight)
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
            let wide = geometry.size.width >= 700
            let edge = wide ? max(24, min(40, geometry.size.width * 0.03)) : 18
            let minimum: CGFloat = wide ? 138 : 116

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 20) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("My List")
                            .font(.system(size: wide ? 29 : 31, weight: .bold))
                            .tracking(-0.9)
                        Text(library.items.isEmpty ? "Saved on this device." : "\(library.items.count) saved \(library.items.count == 1 ? "title" : "titles") · on device")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(.white.opacity(0.38))
                    }
                    .padding(.horizontal, edge)

                    if library.items.isEmpty {
                        VStack(spacing: 11) {
                            Image(systemName: "bookmark")
                                .font(.system(size: 27, weight: .medium))
                                .foregroundStyle(theme.accent)
                            Text("Nothing saved yet")
                                .font(.system(size: 17, weight: .bold))
                            Text("Add a title and it stays in your local SynFlix library.")
                                .font(.system(size: 12.5))
                                .foregroundStyle(.white.opacity(0.40))
                                .multilineTextAlignment(.center)
                        }
                        .padding(26)
                        .frame(maxWidth: 410)
                        .background(Color.white.opacity(0.024), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(.white.opacity(0.055), lineWidth: 0.6)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.top, 42)
                        .padding(.horizontal, edge)
                    } else {
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: minimum), spacing: wide ? 12 : 14)], spacing: wide ? 16 : 18) {
                            ForEach(library.items) { item in
                                Button {
                                    router.open(item)
                                } label: {
                                    VStack(alignment: .leading, spacing: 6) {
                                        ArtworkView(url: item.posterURL, cornerRadius: 7)
                                            .aspectRatio(2.0 / 3.0, contentMode: .fit)
                                            .overlay(alignment: .topTrailing) {
                                                Button {
                                                    library.toggle(item, haptics: theme.hapticsEnabled)
                                                } label: {
                                                    Image(systemName: "xmark")
                                                        .font(.system(size: 10, weight: .bold))
                                                        .foregroundStyle(.white)
                                                        .frame(width: 28, height: 28)
                                                }
                                                .buttonStyle(.plain)
                                                .synflixCircleGlass(tint: .black.opacity(0.16))
                                                .padding(6)
                                            }
                                        Text(item.displayTitle)
                                            .font(.system(size: 12, weight: .semibold))
                                            .foregroundStyle(.white.opacity(0.87))
                                            .lineLimit(1)
                                    }
                                }
                                .buttonStyle(.plain)
                                .hoverEffect(.highlight)
                            }
                        }
                        .padding(.horizontal, edge)
                    }

                    Spacer(minLength: wide ? 34 : 70)
                }
                .padding(.top, wide ? 14 : 8)
            }
            .background(Color.black)
        }
    }
}

struct SettingsView: View {
    @EnvironmentObject private var theme: ThemeStore
    @State private var cacheCleared = false

    private var appVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "—"
    }

    var body: some View {
        GeometryReader { geometry in
            let wide = geometry.size.width >= 700
            let edge = wide ? max(24, min(40, geometry.size.width * 0.03)) : 18
            let columns = wide
                ? [GridItem(.flexible(), spacing: 14), GridItem(.flexible(), spacing: 14)]
                : [GridItem(.flexible())]

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 18) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Settings")
                            .font(.system(size: wide ? 29 : 31, weight: .bold))
                            .tracking(-0.9)
                        Text("Playback, appearance and privacy")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(.white.opacity(0.38))
                    }

                    LazyVGrid(columns: columns, alignment: .leading, spacing: 14) {
                        settingsPanel(title: "Appearance", symbol: "paintpalette.fill") {
                            Picker(selection: $theme.theme) {
                                ForEach(SynFlixTheme.allCases) { choice in
                                    Label(choice.name, systemImage: "circle.fill")
                                        .tag(choice)
                                }
                            } label: {
                                settingsRow("Theme", value: theme.theme.name)
                            }
                            .pickerStyle(.menu)
                            .tint(theme.accent)

                            Divider().overlay(.white.opacity(0.07))

                            HStack(spacing: 10) {
                                Text("Accent")
                                    .font(.system(size: 13, weight: .medium))
                                Spacer()
                                Circle()
                                    .fill(theme.accent)
                                    .frame(width: 16, height: 16)
                                    .overlay(Circle().stroke(.white.opacity(0.18), lineWidth: 0.6))
                            }
                        }

                        settingsPanel(title: "Playback", symbol: "play.rectangle.fill") {
                            Toggle("Autoplay", isOn: $theme.autoplayEnabled)
                                .tint(theme.accent)
                                .font(.system(size: 13, weight: .medium))

                            Divider().overlay(.white.opacity(0.07))

                            settingsRow("Player", value: "Native")
                            settingsRow("External", value: "AirPlay + PiP")
                        }

                        settingsPanel(title: "Privacy", symbol: "hand.raised.fill") {
                            privacyRow("Analytics", value: "Off")
                            privacyRow("Cross-site tracking", value: "None")
                            privacyRow("Cookies", value: "Blocked")
                            privacyRow("My List", value: "On device")

                            Divider().overlay(.white.opacity(0.07))

                            Button {
                                theme.impact()
                                Task {
                                    await SynFlixAPI.shared.clearCache()
                                    URLCache.shared.removeAllCachedResponses()
                                    await MainActor.run { cacheCleared = true }
                                    try? await Task.sleep(nanoseconds: 1_300_000_000)
                                    await MainActor.run { cacheCleared = false }
                                }
                            } label: {
                                HStack {
                                    Image(systemName: cacheCleared ? "checkmark.circle.fill" : "trash")
                                        .foregroundStyle(cacheCleared ? theme.accent : .white.opacity(0.62))
                                    Text(cacheCleared ? "Cache cleared" : "Clear local cache")
                                        .font(.system(size: 12.5, weight: .semibold))
                                    Spacer()
                                }
                                .foregroundStyle(.white.opacity(0.78))
                                .frame(height: 30)
                            }
                            .buttonStyle(.plain)
                        }

                        settingsPanel(title: "Interface", symbol: "rectangle.3.group.fill") {
                            Toggle("Haptics", isOn: $theme.hapticsEnabled)
                                .tint(theme.accent)
                                .font(.system(size: 13, weight: .medium))
                            Divider().overlay(.white.opacity(0.07))
                            Toggle("Reduce Motion", isOn: $theme.reducedMotion)
                                .tint(theme.accent)
                                .font(.system(size: 13, weight: .medium))
                        }

                        settingsPanel(title: "About", symbol: "info.circle.fill") {
                            HStack(spacing: 10) {
                                SynFlixBrandMark(size: 28)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("SynFlix")
                                        .font(.system(size: 13.5, weight: .semibold))
                                    Text("Native client")
                                        .font(.system(size: 10.5, weight: .medium))
                                        .foregroundStyle(.white.opacity(0.38))
                                }
                                Spacer()
                                Text("v\(appVersion)")
                                    .font(.system(size: 11.5, weight: .medium))
                                    .foregroundStyle(.white.opacity(0.42))
                            }
                            Divider().overlay(.white.opacity(0.07))
                            settingsRow("Device", value: UIDevice.current.userInterfaceIdiom == .pad ? "iPad" : "iPhone")
                        }
                    }

                    Text("SynFlix does not include an analytics SDK. Your saved library and preferences stay on this device. Network requests are limited to the SynFlix service and artwork delivery needed to load the catalog.")
                        .font(.system(size: 10.5, weight: .regular))
                        .foregroundStyle(.white.opacity(0.28))
                        .lineSpacing(2)
                        .frame(maxWidth: 680, alignment: .leading)

                    Spacer(minLength: wide ? 34 : 70)
                }
                .padding(.horizontal, edge)
                .padding(.top, wide ? 14 : 8)
            }
            .background(Color.black)
        }
    }

    private func settingsPanel<Content: View>(
        title: String,
        symbol: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: symbol)
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundStyle(theme.accent)
                Text(title)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.90))
            }

            content()
                .foregroundStyle(.white.opacity(0.82))
        }
        .padding(15)
        .frame(maxWidth: .infinity, minHeight: 132, alignment: .topLeading)
        .background(Color.white.opacity(0.024), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(.white.opacity(0.06), lineWidth: 0.6)
        }
    }

    private func settingsRow(_ title: String, value: String) -> some View {
        HStack {
            Text(title)
                .font(.system(size: 13, weight: .medium))
            Spacer()
            Text(value)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(.white.opacity(0.42))
        }
        .frame(minHeight: 27)
    }

    private func privacyRow(_ title: String, value: String) -> some View {
        HStack {
            Text(title)
                .font(.system(size: 12.5, weight: .medium))
            Spacer()
            Text(value)
                .font(.system(size: 11.5, weight: .semibold))
                .foregroundStyle(value == "Off" || value == "None" || value == "Blocked" ? theme.accent.opacity(0.84) : .white.opacity(0.42))
        }
    }
}
