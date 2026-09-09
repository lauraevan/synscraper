import SwiftUI
import UIKit

struct ContentView: View {
    @StateObject private var theme = ThemeStore()
    @StateObject private var library = LibraryStore()
    @StateObject private var router = AppRouter()

    @State private var selectedSection: RootSection = .home
    @State private var showLaunch = true

    var body: some View {
        GeometryReader { geometry in
            let isPad = UIDevice.current.userInterfaceIdiom == .pad
            let useTabletChrome = isPad && geometry.size.width >= 720
            let safeTop = geometry.safeAreaInsets.top
            let safeBottom = geometry.safeAreaInsets.bottom

            ZStack {
                Color.black.ignoresSafeArea()

                rootContent
                    .environmentObject(theme)
                    .environmentObject(library)
                    .environmentObject(router)
                    .padding(.top, selectedSection == .home ? 0 : safeTop + (useTabletChrome ? 58 : 66))
                    .padding(.bottom, useTabletChrome ? 0 : safeBottom + 72)
                    .animation(theme.reducedMotion ? nil : .easeOut(duration: 0.16), value: selectedSection)

                VStack(spacing: 0) {
                    if useTabletChrome {
                        tabletHeader(width: geometry.size.width)
                            .padding(.top, safeTop)
                    } else {
                        compactHeader
                            .padding(.top, safeTop + 8)
                            .padding(.horizontal, 12)
                    }
                    Spacer(minLength: 0)
                }

                if !useTabletChrome {
                    VStack(spacing: 0) {
                        Spacer(minLength: 0)
                        bottomDock
                            .padding(.horizontal, 12)
                            .padding(.bottom, max(8, safeBottom))
                    }
                }

                if showLaunch {
                    launchOverlay
                        .transition(.opacity)
                        .zIndex(50)
                }
            }
            .ignoresSafeArea(edges: selectedSection == .home ? .top : [])
        }
        .preferredColorScheme(.dark)
        .tint(theme.accent)
        .environmentObject(theme)
        .environmentObject(library)
        .environmentObject(router)
        .fullScreenCover(item: $router.selectedItem) { item in
            DetailView(item: item)
                .environmentObject(theme)
                .environmentObject(library)
                .environmentObject(router)
        }
        .fullScreenCover(item: $router.rootPlayer) { request in
            NativePlayerView(request: request)
                .environmentObject(theme)
        }
        .task {
            try? await Task.sleep(nanoseconds: 460_000_000)
            withAnimation(theme.reducedMotion ? nil : .easeOut(duration: 0.24)) {
                showLaunch = false
            }
        }
    }

    @ViewBuilder
    private var rootContent: some View {
        switch selectedSection {
        case .home:
            HomeView().transition(.opacity)
        case .search:
            SearchView().transition(.opacity)
        case .library:
            LibraryView().transition(.opacity)
        case .settings:
            SettingsView().transition(.opacity)
        }
    }

    private func tabletHeader(width: CGFloat) -> some View {
        let edge = max(30, min(48, width * 0.034))

        return HStack(spacing: 28) {
            HStack(spacing: 9) {
                SynFlixBrandMark(size: 29)
                Text("SynFlix")
                    .font(.system(size: 17, weight: .bold))
                    .tracking(-0.45)
            }
            .accessibilityElement(children: .combine)

            HStack(spacing: 26) {
                tabletNavButton(.home)
                tabletNavButton(.search)
                tabletNavButton(.library)
            }

            Spacer(minLength: 20)

            if selectedSection != .search {
                Button {
                    theme.impact()
                    selectedSection = .search
                } label: {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 14.5, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.84))
                        .frame(width: 38, height: 38)
                }
                .buttonStyle(.plain)
                .synflixCircleGlass(tint: theme.accent.opacity(0.018))
                .accessibilityLabel("Search")
            }

            Button {
                theme.impact()
                selectedSection = .settings
            } label: {
                ZStack {
                    Circle()
                        .fill(selectedSection == .settings ? theme.accent.opacity(0.15) : Color.white.opacity(0.035))
                    Image(systemName: "person.fill")
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(selectedSection == .settings ? theme.accent : .white.opacity(0.82))
                }
                .frame(width: 38, height: 38)
            }
            .buttonStyle(.plain)
            .synflixCircleGlass(tint: theme.accent.opacity(selectedSection == .settings ? 0.055 : 0.018))
            .accessibilityLabel("Settings")
        }
        .padding(.horizontal, edge)
        .frame(height: 58)
        .background(.ultraThinMaterial)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(.white.opacity(0.055))
                .frame(height: 0.5)
        }
    }

    private func tabletNavButton(_ section: RootSection) -> some View {
        Button {
            if selectedSection != section {
                theme.impact()
                selectedSection = section
            }
        } label: {
            Text(section.title)
                .font(.system(size: 13.5, weight: selectedSection == section ? .semibold : .medium))
                .foregroundStyle(selectedSection == section ? .white : .white.opacity(0.50))
                .padding(.vertical, 19)
                .contentShape(Rectangle())
                .overlay(alignment: .bottom) {
                    if selectedSection == section {
                        Capsule()
                            .fill(theme.accent)
                            .frame(width: 22, height: 2)
                    }
                }
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selectedSection == section ? [.isSelected] : [])
    }

    private var compactHeader: some View {
        HStack(spacing: 10) {
            SynFlixBrandMark(size: 31)
            Text("SynFlix")
                .font(.system(size: 16, weight: .bold))
                .tracking(-0.4)

            Spacer(minLength: 8)

            if selectedSection != .search {
                Button {
                    theme.impact()
                    selectedSection = .search
                } label: {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.90))
                        .frame(width: 38, height: 38)
                }
                .buttonStyle(.plain)
                .synflixCircleGlass(tint: theme.accent.opacity(0.022))
                .accessibilityLabel("Search")
            }

            Button {
                theme.impact()
                selectedSection = .settings
            } label: {
                Image(systemName: "person.fill")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(selectedSection == .settings ? theme.accent : .white.opacity(0.86))
                    .frame(width: 38, height: 38)
            }
            .buttonStyle(.plain)
            .synflixCircleGlass(tint: theme.accent.opacity(0.030))
            .accessibilityLabel("Settings")
        }
        .padding(.leading, 11)
        .padding(.trailing, 7)
        .frame(height: 52)
        .frame(maxWidth: 560)
        .synflixGlass(tint: theme.accent.opacity(0.024), cornerRadius: 25)
        .frame(maxWidth: .infinity)
    }

    private var bottomDock: some View {
        HStack(spacing: 0) {
            ForEach(RootSection.allCases) { section in
                Button {
                    if selectedSection != section {
                        theme.impact()
                        selectedSection = section
                    } else {
                        theme.impact(.light)
                    }
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: section.symbol)
                            .font(.system(size: 16, weight: .semibold))
                        Text(section.title)
                            .font(.system(size: 9.5, weight: .semibold))
                    }
                    .foregroundStyle(selectedSection == section ? theme.accent : .white.opacity(0.42))
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selectedSection == section ? [.isSelected] : [])
            }
        }
        .padding(5)
        .frame(maxWidth: 430)
        .synflixGlass(tint: theme.accent.opacity(0.026), cornerRadius: 30, interactive: true)
        .shadow(color: .black.opacity(0.26), radius: 20, y: 9)
        .frame(maxWidth: .infinity)
    }

    private var launchOverlay: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            RadialGradient(
                colors: [theme.accent.opacity(0.065), .clear],
                center: .center,
                startRadius: 4,
                endRadius: 320
            )
            .ignoresSafeArea()

            VStack(spacing: 12) {
                SynFlixBrandMark(size: 96)
                Text("SynFlix")
                    .font(.system(size: 28, weight: .bold))
                    .tracking(-0.85)
            }
        }
    }
}
