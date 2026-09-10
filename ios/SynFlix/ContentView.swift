import SwiftUI

struct ContentView: View {
    @StateObject private var theme = ThemeStore()
    @StateObject private var library = LibraryStore()
    @StateObject private var router = AppRouter()

    @State private var selectedSection: RootSection = .home
    @State private var showLaunch = true

    var body: some View {
        GeometryReader { geometry in
            let desktopLayout = UIDevice.current.userInterfaceIdiom == .pad && geometry.size.width >= 720

            ZStack {
                Color.black.ignoresSafeArea()

                if desktopLayout {
                    desktopShell
                } else {
                    compactShell
                }

                if showLaunch {
                    launchOverlay
                        .transition(.opacity)
                        .zIndex(50)
                }
            }
            .environmentObject(theme)
            .environmentObject(library)
            .environmentObject(router)
        }
        .preferredColorScheme(.dark)
        .tint(theme.accent)
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
            withAnimation(theme.reducedMotion ? nil : .easeOut(duration: 0.22)) {
                showLaunch = false
            }
        }
    }

    private var desktopShell: some View {
        HStack(spacing: 0) {
            desktopSidebar
                .frame(width: 76)

            ZStack(alignment: .top) {
                rootContent
                    .padding(.top, selectedSection == .home ? 0 : 54)

                desktopToolbar
            }
            .background(Color.black)
        }
    }

    private var compactShell: some View {
        ZStack {
            rootContent
                .padding(.top, selectedSection == .home ? 0 : 54)
                .padding(.bottom, 67)

            VStack(spacing: 0) {
                compactTopBar
                Spacer(minLength: 0)
                compactDock
            }
        }
    }

    @ViewBuilder
    private var rootContent: some View {
        switch selectedSection {
        case .home:
            HomeView()
        case .search:
            SearchView()
        case .library:
            LibraryView()
        case .settings:
            SettingsView()
        }
    }

    private var desktopSidebar: some View {
        VStack(spacing: 8) {
            SynFlixBrandMark(size: 36)
                .padding(.top, 14)
                .padding(.bottom, 15)

            Rectangle()
                .fill(.white.opacity(0.08))
                .frame(width: 28, height: 0.5)
                .padding(.bottom, 8)

            ForEach(RootSection.allCases) { section in
                sidebarButton(section)
            }

            Spacer(minLength: 10)

            VStack(spacing: 6) {
                Circle()
                    .fill(theme.accent.opacity(0.85))
                    .frame(width: 5, height: 5)
                Text("LOCAL")
                    .font(.system(size: 7.5, weight: .bold))
                    .tracking(1.1)
                    .foregroundStyle(.white.opacity(0.28))
            }
            .padding(.bottom, 15)
        }
        .frame(maxHeight: .infinity)
        .background(.ultraThinMaterial)
        .overlay(alignment: .trailing) {
            Rectangle()
                .fill(.white.opacity(0.07))
                .frame(width: 0.5)
        }
    }

    private func sidebarButton(_ section: RootSection) -> some View {
        Button {
            theme.impact()
            selectedSection = section
        } label: {
            ZStack(alignment: .leading) {
                Color.clear
                    .frame(width: 54, height: 48)

                if selectedSection == section {
                    Capsule()
                        .fill(theme.accent)
                        .frame(width: 2.5, height: 20)
                        .offset(x: -1)
                }

                Image(systemName: section.symbol)
                    .font(.system(size: 17, weight: .semibold))
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(selectedSection == section ? theme.accent : .white.opacity(0.44))
                    .frame(width: 54, height: 48)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .hoverEffect(.highlight)
        .keyboardShortcut(section.shortcut, modifiers: .command)
        .accessibilityLabel(section.title)
        .accessibilityAddTraits(selectedSection == section ? [.isSelected] : [])
    }

    private var desktopToolbar: some View {
        HStack(spacing: 12) {
            Text(selectedSection == .home ? "Browse" : selectedSection.title)
                .font(.system(size: 17, weight: .semibold))
                .tracking(-0.35)
                .foregroundStyle(.white.opacity(0.90))

            Spacer(minLength: 12)

            Button {
                theme.impact()
                selectedSection = .search
            } label: {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 14.5, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.78))
                    .frame(width: 38, height: 38)
            }
            .buttonStyle(.plain)
            .synflixCircleGlass(tint: Color.white.opacity(0.01))
            .hoverEffect(.highlight)
            .accessibilityLabel("Search")

            Button {
                theme.impact()
                selectedSection = .settings
            } label: {
                Image(systemName: "person.crop.circle.fill")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(theme.accent.opacity(0.92))
                    .frame(width: 38, height: 38)
            }
            .buttonStyle(.plain)
            .synflixCircleGlass(tint: theme.accent.opacity(0.025))
            .hoverEffect(.highlight)
            .accessibilityLabel("Settings")
        }
        .padding(.horizontal, 18)
        .frame(height: 54)
        .background(.ultraThinMaterial)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(.white.opacity(0.065))
                .frame(height: 0.5)
        }
    }

    private var compactTopBar: some View {
        HStack(spacing: 10) {
            SynFlixBrandMark(size: 30)
            Text("SynFlix")
                .font(.system(size: 16, weight: .bold))
                .tracking(-0.35)
            Spacer()
            Button {
                theme.impact()
                selectedSection = .search
            } label: {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 14.5, weight: .semibold))
                    .frame(width: 36, height: 36)
            }
            .buttonStyle(.plain)
            .foregroundStyle(.white.opacity(0.84))
        }
        .padding(.horizontal, 14)
        .frame(height: 54)
        .background(.ultraThinMaterial)
        .overlay(alignment: .bottom) {
            Rectangle().fill(.white.opacity(0.065)).frame(height: 0.5)
        }
    }

    private var compactDock: some View {
        HStack(spacing: 0) {
            ForEach(RootSection.allCases) { section in
                Button {
                    theme.impact()
                    selectedSection = section
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: section.symbol)
                            .font(.system(size: 16.5, weight: .semibold))
                            .symbolRenderingMode(.hierarchical)
                        Text(section.title)
                            .font(.system(size: 9.5, weight: .semibold))
                            .lineLimit(1)
                    }
                    .foregroundStyle(selectedSection == section ? theme.accent : .white.opacity(0.42))
                    .frame(maxWidth: .infinity)
                    .frame(height: 58)
                    .contentShape(Rectangle())
                    .overlay(alignment: .top) {
                        if selectedSection == section {
                            Capsule()
                                .fill(theme.accent)
                                .frame(width: 20, height: 2)
                        }
                    }
                }
                .buttonStyle(.plain)
                .accessibilityLabel(section.title)
                .accessibilityAddTraits(selectedSection == section ? [.isSelected] : [])
            }
        }
        .padding(.top, 3)
        .background(.ultraThinMaterial)
        .overlay(alignment: .top) {
            Rectangle().fill(.white.opacity(0.065)).frame(height: 0.5)
        }
    }

    private var launchOverlay: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(spacing: 14) {
                SynFlixBrandMark(size: 78)
                Text("SynFlix")
                    .font(.system(size: 26, weight: .bold))
                    .tracking(-0.75)
                ProgressView()
                    .controlSize(.small)
                    .tint(theme.accent)
                    .padding(.top, 2)
            }
        }
    }
}
