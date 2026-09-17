import SwiftUI

struct ContentView: View {
    @StateObject private var theme = ThemeStore()
    @StateObject private var library = LibraryStore()
    @StateObject private var router = AppRouter()

    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var selectedSection: RootSection = .home
    @State private var showLaunch = true

    var body: some View {
        GeometryReader { geometry in
            let useSidebar = horizontalSizeClass == .regular && geometry.size.width >= 700

            ZStack {
                Color.black.ignoresSafeArea()

                rootContent
                    .environmentObject(theme)
                    .environmentObject(library)
                    .environmentObject(router)
                    .padding(.leading, useSidebar ? 94 : 0)
                    .padding(.top, selectedSection == .home ? 0 : geometry.safeAreaInsets.top + (useSidebar ? 12 : 64))
                    .padding(.bottom, useSidebar ? 0 : geometry.safeAreaInsets.bottom + 76)
                    .animation(theme.reducedMotion ? nil : .easeOut(duration: 0.18), value: selectedSection)

                if useSidebar {
                    iPadChrome(geometry: geometry)
                } else {
                    mobileChrome(geometry: geometry)
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
            try? await Task.sleep(nanoseconds: 620_000_000)
            withAnimation(theme.reducedMotion ? nil : .easeOut(duration: 0.28)) {
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

    private func iPadChrome(geometry: GeometryProxy) -> some View {
        ZStack {
            HStack {
                VStack(spacing: 0) {
                    SynFlixBrandMark(size: 42)
                        .padding(.top, 15)
                        .padding(.bottom, 20)

                    VStack(spacing: 7) {
                        ForEach(RootSection.allCases.filter { $0 != .settings }) { section in
                            railButton(section)
                        }
                    }

                    Spacer(minLength: 18)

                    railButton(.settings)
                        .padding(.bottom, 13)
                }
                .padding(.horizontal, 7)
                .frame(width: 68)
                .frame(maxHeight: .infinity)
                .synflixGlass(tint: theme.accent.opacity(0.018), cornerRadius: 31)
                .shadow(color: .black.opacity(0.34), radius: 30, x: 8, y: 10)
                .padding(.leading, 12)
                .padding(.top, geometry.safeAreaInsets.top + 10)
                .padding(.bottom, max(12, geometry.safeAreaInsets.bottom + 10))

                Spacer()
            }

            VStack {
                HStack {
                    Spacer()

                    HStack(spacing: 8) {
                        if selectedSection != .search {
                            chromeCircle(symbol: "magnifyingglass", label: "Search") {
                                selectedSection = .search
                            }
                        }

                        chromeCircle(symbol: "person.fill", label: "Settings", accented: true) {
                            selectedSection = .settings
                        }
                    }
                    .padding(.trailing, 22)
                    .padding(.top, geometry.safeAreaInsets.top + 12)
                }
                Spacer()
            }
        }
    }

    private func railButton(_ section: RootSection) -> some View {
        Button {
            if selectedSection != section {
                theme.impact()
                selectedSection = section
            } else {
                theme.impact(.light)
            }
        } label: {
            ZStack {
                if selectedSection == section {
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(theme.accent.opacity(0.10))
                        .overlay {
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .stroke(theme.accent.opacity(0.18), lineWidth: 0.7)
                        }
                }

                Image(systemName: section.symbol)
                    .font(.system(size: 18, weight: .semibold))
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(selectedSection == section ? theme.accent : .white.opacity(0.48))
            }
            .frame(width: 52, height: 52)
            .contentShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(.plain)
        .hoverEffect(.highlight)
        .keyboardShortcut(section.shortcut, modifiers: .command)
        .accessibilityLabel(section.title)
        .accessibilityAddTraits(selectedSection == section ? [.isSelected] : [])
    }

    private func mobileChrome(geometry: GeometryProxy) -> some View {
        ZStack {
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
        }
    }

    private var topChrome: some View {
        HStack(spacing: 10) {
            SynFlixBrandMark(size: 31)

            Text("SynFlix")
                .font(.system(size: 16, weight: .bold))
                .tracking(-0.4)

            if selectedSection != .home {
                Rectangle()
                    .fill(.white.opacity(0.11))
                    .frame(width: 1, height: 16)

                Text(selectedSection.title)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.48))
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
                .synflixCircleGlass(tint: theme.accent.opacity(0.02))
                .accessibilityLabel("Search")
            }
        }
        .padding(.leading, 11)
        .padding(.trailing, 7)
        .frame(height: 52)
        .synflixGlass(tint: theme.accent.opacity(0.025), cornerRadius: 25)
    }

    private func chromeCircle(symbol: String, label: String, accented: Bool = false, action: @escaping () -> Void) -> some View {
        Button {
            theme.impact()
            action()
        } label: {
            Image(systemName: symbol)
                .font(.system(size: 14.5, weight: .semibold))
                .foregroundStyle(accented ? theme.accent : .white.opacity(0.88))
                .frame(width: 42, height: 42)
        }
        .buttonStyle(.plain)
        .synflixCircleGlass(tint: accented ? theme.accent.opacity(0.045) : Color.white.opacity(0.008))
        .accessibilityLabel(label)
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
        .synflixGlass(tint: theme.accent.opacity(0.028), cornerRadius: 31, interactive: true)
        .shadow(color: .black.opacity(0.34), radius: 24, y: 10)
        .frame(maxWidth: .infinity)
    }

    private var launchOverlay: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            RadialGradient(
                colors: [theme.accent.opacity(0.085), .clear],
                center: .center,
                startRadius: 6,
                endRadius: 300
            )
            .ignoresSafeArea()

            VStack(spacing: 14) {
                SynFlixBrandMark(size: 94)

                Text("SynFlix")
                    .font(.system(size: 30, weight: .heavy))
                    .tracking(-1.0)

                Capsule()
                    .fill(theme.accent)
                    .frame(width: 26, height: 3)
            }
        }
    }
}
