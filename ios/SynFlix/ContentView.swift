import SwiftUI

struct ContentView: View {
    @StateObject private var theme = ThemeStore()
    @StateObject private var library = LibraryStore()
    @StateObject private var router = AppRouter()

    @State private var selectedSection: RootSection = .home
    @State private var showLaunch = true

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                Color.black.ignoresSafeArea()

                rootContent
                    .environmentObject(theme)
                    .environmentObject(library)
                    .environmentObject(router)
                    .padding(.top, selectedSection == .home ? 0 : geometry.safeAreaInsets.top + 72)
                    .padding(.bottom, geometry.safeAreaInsets.bottom + 78)
                    .animation(theme.reducedMotion ? nil : .easeOut(duration: 0.20), value: selectedSection)

                VStack(spacing: 0) {
                    topChrome
                        .padding(.top, geometry.safeAreaInsets.top + 8)
                        .padding(.horizontal, 12)
                    Spacer()
                }

                VStack(spacing: 0) {
                    Spacer()
                    bottomDock
                        .padding(.horizontal, 12)
                        .padding(.bottom, max(8, geometry.safeAreaInsets.bottom))
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
            try? await Task.sleep(nanoseconds: 760_000_000)
            withAnimation(theme.reducedMotion ? nil : .easeOut(duration: 0.34)) {
                showLaunch = false
            }
        }
    }

    @ViewBuilder
    private var rootContent: some View {
        switch selectedSection {
        case .home:
            HomeView()
                .transition(.opacity)
        case .search:
            SearchView()
                .transition(.opacity)
        case .library:
            LibraryView()
                .transition(.opacity)
        case .settings:
            SettingsView()
                .transition(.opacity)
        }
    }

    private var topChrome: some View {
        HStack(spacing: 10) {
            SynFlixBrandMark(size: 31)

            VStack(alignment: .leading, spacing: 0) {
                Text("SynFlix")
                    .font(.system(size: 15.5, weight: .bold))
                    .tracking(-0.35)
                Text(selectedSection == .home ? "Premium streaming" : selectedSection.title)
                    .font(.system(size: 9.5, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.38))
            }

            Spacer(minLength: 8)

            if selectedSection != .search {
                Button {
                    theme.impact()
                    selectedSection = .search
                } label: {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.88))
                        .frame(width: 38, height: 38)
                }
                .buttonStyle(.plain)
                .synflixCircleGlass(tint: theme.accent.opacity(0.025))
                .accessibilityLabel("Search")
            }

            Button {
                theme.impact()
                selectedSection = .settings
            } label: {
                ZStack {
                    Circle()
                        .fill(theme.accent.opacity(0.14))
                    Circle()
                        .stroke(theme.accent.opacity(0.38), lineWidth: 0.8)
                    Image(systemName: "person.fill")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(theme.accent)
                }
                .frame(width: 38, height: 38)
            }
            .buttonStyle(.plain)
            .synflixCircleGlass(tint: theme.accent.opacity(0.035))
            .accessibilityLabel("Settings")
        }
        .padding(.leading, 11)
        .padding(.trailing, 7)
        .frame(height: 52)
        .frame(maxWidth: 680)
        .synflixGlass(tint: theme.accent.opacity(0.035), cornerRadius: 25)
        .frame(maxWidth: .infinity)
    }

    private var bottomDock: some View {
        HStack(spacing: 2) {
            ForEach(RootSection.allCases) { section in
                Button {
                    if selectedSection == section {
                        theme.impact(.light)
                    } else {
                        theme.impact()
                        selectedSection = section
                    }
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: section.symbol)
                            .font(.system(size: 16, weight: .semibold))
                            .symbolRenderingMode(.hierarchical)

                        Text(section.title)
                            .font(.system(size: 9.5, weight: .semibold))
                            .lineLimit(1)
                    }
                    .foregroundStyle(selectedSection == section ? theme.accent : .white.opacity(0.42))
                    .frame(maxWidth: .infinity)
                    .frame(height: 51)
                    .contentShape(Rectangle())
                    .background {
                        if selectedSection == section {
                            Capsule()
                                .fill(theme.accent.opacity(0.09))
                                .padding(.horizontal, 3)
                                .padding(.vertical, 2)
                        }
                    }
                    .overlay(alignment: .top) {
                        if selectedSection == section {
                            Capsule()
                                .fill(theme.accent)
                                .frame(width: 18, height: 2)
                                .offset(y: -1)
                        }
                    }
                }
                .buttonStyle(.plain)
                .accessibilityLabel(section.title)
                .accessibilityAddTraits(selectedSection == section ? [.isSelected] : [])
            }
        }
        .padding(5)
        .frame(maxWidth: 530)
        .synflixGlass(tint: theme.accent.opacity(0.032), cornerRadius: 31, interactive: true)
        .shadow(color: .black.opacity(0.34), radius: 24, y: 10)
        .frame(maxWidth: .infinity)
    }

    private var launchOverlay: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            RadialGradient(
                colors: [theme.accent.opacity(0.10), .clear],
                center: .center,
                startRadius: 4,
                endRadius: 260
            )
            .ignoresSafeArea()

            VStack(spacing: 16) {
                SynFlixBrandMark(size: 92)
                VStack(spacing: 4) {
                    Text("SynFlix")
                        .font(.system(size: 29, weight: .heavy))
                        .tracking(-0.9)
                    Text("NATIVE")
                        .font(.system(size: 9, weight: .black))
                        .tracking(2.2)
                        .foregroundStyle(theme.accent)
                }
            }
            .scaleEffect(showLaunch ? 1 : 0.985)
        }
    }
}
