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
            let isPad = UIDevice.current.userInterfaceIdiom == .pad || geometry.size.width >= 700
            let safeTop = geometry.safeAreaInsets.top
            let safeBottom = geometry.safeAreaInsets.bottom
            let dockWidth = min(geometry.size.width - (isPad ? 56 : 24), isPad ? 540 : 420)

            ZStack {
                Color(red: 0.018, green: 0.018, blue: 0.018)
                    .ignoresSafeArea()

                rootContent
                    .environmentObject(theme)
                    .environmentObject(library)
                    .environmentObject(router)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .padding(.top, selectedSection == .home ? 0 : safeTop + (isPad ? 58 : 62))
                    .ignoresSafeArea()
                    .animation(theme.reducedMotion ? nil : .easeOut(duration: 0.16), value: selectedSection)

                VStack(spacing: 0) {
                    header(isPad: isPad)
                        .padding(.top, safeTop + (isPad ? 10 : 7))
                        .padding(.horizontal, isPad ? 30 : 14)
                    Spacer(minLength: 0)
                }
                .allowsHitTesting(true)

                VStack(spacing: 0) {
                    Spacer(minLength: 0)
                    dock(isPad: isPad)
                        .frame(width: dockWidth)
                        .padding(.bottom, max(isPad ? 10 : 7, safeBottom + 2))
                }

                if showLaunch {
                    launchOverlay
                        .transition(.opacity)
                        .zIndex(50)
                }
            }
            .ignoresSafeArea()
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
            try? await Task.sleep(nanoseconds: 340_000_000)
            withAnimation(theme.reducedMotion ? nil : .easeOut(duration: 0.22)) {
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

    private func header(isPad: Bool) -> some View {
        HStack(spacing: 11) {
            Button {
                theme.impact(.light)
                selectedSection = .home
            } label: {
                HStack(spacing: 9) {
                    SynFlixBrandMark(size: isPad ? 34 : 31)

                    Text("SynFlix")
                        .font(.system(size: isPad ? 18 : 16.5, weight: .bold))
                        .tracking(-0.55)
                        .foregroundStyle(.white)
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel("SynFlix Home")

            if isPad && selectedSection != .home {
                Rectangle()
                    .fill(.white.opacity(0.12))
                    .frame(width: 1, height: 18)

                Text(selectedSection.title)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.48))
            }

            Spacer(minLength: 10)

            if isPad {
                HStack(spacing: 3) {
                    headerDestination("Home", section: .home)
                    headerDestination("My List", section: .library)
                }
                .padding(4)
                .synflixGlass(tint: theme.accent.opacity(0.018), cornerRadius: 18, interactive: true)
            }

            if selectedSection != .search {
                chromeButton(symbol: "magnifyingglass", label: "Search", isPad: isPad) {
                    selectedSection = .search
                }
            }

            chromeButton(symbol: "person.fill", label: "Settings", isPad: isPad, selected: selectedSection == .settings) {
                selectedSection = .settings
            }
        }
        .frame(maxWidth: .infinity)
    }

    private func headerDestination(_ title: String, section: RootSection) -> some View {
        Button {
            if selectedSection != section {
                theme.impact()
                selectedSection = section
            }
        } label: {
            Text(title)
                .font(.system(size: 11.5, weight: .semibold))
                .foregroundStyle(selectedSection == section ? .white : .white.opacity(0.50))
                .padding(.horizontal, 13)
                .frame(height: 30)
                .background {
                    if selectedSection == section {
                        Capsule().fill(.white.opacity(0.085))
                    }
                }
        }
        .buttonStyle(.plain)
    }

    private func chromeButton(
        symbol: String,
        label: String,
        isPad: Bool,
        selected: Bool = false,
        action: @escaping () -> Void
    ) -> some View {
        Button {
            theme.impact()
            action()
        } label: {
            Image(systemName: symbol)
                .font(.system(size: isPad ? 14.5 : 14, weight: .semibold))
                .foregroundStyle(selected ? theme.accent : .white.opacity(0.88))
                .frame(width: isPad ? 40 : 38, height: isPad ? 40 : 38)
        }
        .buttonStyle(.plain)
        .synflixCircleGlass(tint: selected ? theme.accent.opacity(0.07) : Color.white.opacity(0.008))
        .accessibilityLabel(label)
    }

    private func dock(isPad: Bool) -> some View {
        HStack(spacing: isPad ? 2 : 0) {
            ForEach(RootSection.allCases) { section in
                Button {
                    if selectedSection != section {
                        theme.impact()
                        withAnimation(theme.reducedMotion ? nil : .spring(response: 0.26, dampingFraction: 0.86)) {
                            selectedSection = section
                        }
                    } else {
                        theme.impact(.light)
                    }
                } label: {
                    VStack(spacing: isPad ? 4 : 3) {
                        Image(systemName: section.symbol)
                            .font(.system(size: isPad ? 17 : 16, weight: .semibold))
                            .symbolRenderingMode(.hierarchical)

                        Text(section.title)
                            .font(.system(size: isPad ? 10 : 9.3, weight: .semibold))
                            .lineLimit(1)
                    }
                    .foregroundStyle(selectedSection == section ? theme.accent : .white.opacity(0.43))
                    .frame(maxWidth: .infinity)
                    .frame(height: isPad ? 50 : 48)
                    .contentShape(Rectangle())
                    .background {
                        if selectedSection == section {
                            Capsule()
                                .fill(theme.accent.opacity(0.075))
                                .padding(.horizontal, 4)
                                .padding(.vertical, 2)
                        }
                    }
                }
                .buttonStyle(.plain)
                .accessibilityLabel(section.title)
                .accessibilityAddTraits(selectedSection == section ? [.isSelected] : [])
            }
        }
        .padding(isPad ? 6 : 5)
        .synflixGlass(tint: theme.accent.opacity(0.026), cornerRadius: isPad ? 31 : 29, interactive: true)
        .overlay {
            RoundedRectangle(cornerRadius: isPad ? 31 : 29, style: .continuous)
                .stroke(
                    LinearGradient(
                        colors: [.white.opacity(0.18), .white.opacity(0.055), .clear],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 0.65
                )
                .allowsHitTesting(false)
        }
        .shadow(color: .black.opacity(0.30), radius: 20, y: 8)
    }

    private var launchOverlay: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(spacing: 11) {
                SynFlixBrandMark(size: 92)
                Text("SynFlix")
                    .font(.system(size: 27, weight: .bold))
                    .tracking(-0.85)
            }
        }
    }
}
