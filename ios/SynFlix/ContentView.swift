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
            let safeTop = geometry.safeAreaInsets.top
            let safeBottom = geometry.safeAreaInsets.bottom
            let dockWidth = min(
                geometry.size.width - (isPad ? 44 : 24),
                isPad ? 640 : 440
            )
            let bottomClearance = safeBottom + (isPad ? 94 : 82)

            ZStack {
                Color.black.ignoresSafeArea()

                rootContent
                    .environmentObject(theme)
                    .environmentObject(library)
                    .environmentObject(router)
                    .padding(.top, selectedSection == .home ? 0 : safeTop + (isPad ? 62 : 66))
                    .padding(.bottom, bottomClearance)
                    .animation(theme.reducedMotion ? nil : .easeOut(duration: 0.16), value: selectedSection)

                VStack(spacing: 0) {
                    floatingHeader(isPad: isPad)
                        .padding(.top, safeTop + (isPad ? 10 : 8))
                        .padding(.horizontal, isPad ? 22 : 12)
                    Spacer(minLength: 0)
                }

                VStack(spacing: 0) {
                    Spacer(minLength: 0)
                    liquidDock(isPad: isPad)
                        .frame(width: dockWidth)
                        .padding(.bottom, max(isPad ? 12 : 8, safeBottom))
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

    private func floatingHeader(isPad: Bool) -> some View {
        HStack(spacing: isPad ? 12 : 10) {
            SynFlixBrandMark(size: isPad ? 33 : 31)

            HStack(spacing: 8) {
                Text("SynFlix")
                    .font(.system(size: isPad ? 17 : 16, weight: .bold))
                    .tracking(-0.45)

                if isPad {
                    Rectangle()
                        .fill(.white.opacity(0.11))
                        .frame(width: 1, height: 16)

                    Text(selectedSection.title)
                        .font(.system(size: 12.5, weight: .medium))
                        .foregroundStyle(.white.opacity(0.48))
                }
            }

            Spacer(minLength: 8)

            if selectedSection != .search {
                Button {
                    theme.impact()
                    selectedSection = .search
                } label: {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: isPad ? 15 : 14, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.90))
                        .frame(width: isPad ? 40 : 38, height: isPad ? 40 : 38)
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
                        .fill(selectedSection == .settings ? theme.accent.opacity(0.12) : .clear)
                    Image(systemName: "person.fill")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(selectedSection == .settings ? theme.accent : .white.opacity(0.86))
                }
                .frame(width: isPad ? 40 : 38, height: isPad ? 40 : 38)
            }
            .buttonStyle(.plain)
            .synflixCircleGlass(tint: theme.accent.opacity(selectedSection == .settings ? 0.045 : 0.018))
            .accessibilityLabel("Settings")
        }
        .padding(.leading, isPad ? 14 : 11)
        .padding(.trailing, isPad ? 8 : 7)
        .frame(height: isPad ? 56 : 52)
        .frame(maxWidth: isPad ? 720 : 560)
        .synflixGlass(tint: theme.accent.opacity(0.022), cornerRadius: isPad ? 28 : 25, interactive: true)
        .overlay {
            RoundedRectangle(cornerRadius: isPad ? 28 : 25, style: .continuous)
                .stroke(
                    LinearGradient(
                        colors: [.white.opacity(0.16), .white.opacity(0.035), .clear],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 0.65
                )
                .allowsHitTesting(false)
        }
        .shadow(color: .black.opacity(0.22), radius: 18, y: 7)
        .frame(maxWidth: .infinity)
    }

    private func liquidDock(isPad: Bool) -> some View {
        HStack(spacing: isPad ? 5 : 2) {
            ForEach(RootSection.allCases) { section in
                Button {
                    if selectedSection != section {
                        theme.impact()
                        withAnimation(theme.reducedMotion ? nil : .spring(response: 0.28, dampingFraction: 0.84)) {
                            selectedSection = section
                        }
                    } else {
                        theme.impact(.light)
                    }
                } label: {
                    ZStack {
                        if selectedSection == section {
                            RoundedRectangle(cornerRadius: isPad ? 22 : 20, style: .continuous)
                                .fill(theme.accent.opacity(0.095))
                                .overlay {
                                    RoundedRectangle(cornerRadius: isPad ? 22 : 20, style: .continuous)
                                        .stroke(
                                            LinearGradient(
                                                colors: [theme.accent.opacity(0.42), .white.opacity(0.11), .clear],
                                                startPoint: .topLeading,
                                                endPoint: .bottomTrailing
                                            ),
                                            lineWidth: 0.7
                                        )
                                }
                                .shadow(color: theme.accent.opacity(0.10), radius: 12, y: 4)
                        }

                        VStack(spacing: isPad ? 5 : 4) {
                            Image(systemName: section.symbol)
                                .font(.system(size: isPad ? 18 : 16.5, weight: .semibold))
                                .symbolRenderingMode(.hierarchical)

                            Text(section.title)
                                .font(.system(size: isPad ? 10.5 : 9.5, weight: .semibold))
                                .lineLimit(1)
                        }
                        .foregroundStyle(selectedSection == section ? theme.accent : .white.opacity(0.45))
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: isPad ? 58 : 52)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(section.title)
                .accessibilityAddTraits(selectedSection == section ? [.isSelected] : [])
            }
        }
        .padding(isPad ? 7 : 6)
        .synflixGlass(tint: theme.accent.opacity(0.040), cornerRadius: isPad ? 35 : 32, interactive: true)
        .overlay {
            RoundedRectangle(cornerRadius: isPad ? 35 : 32, style: .continuous)
                .stroke(
                    LinearGradient(
                        colors: [
                            .white.opacity(0.23),
                            .white.opacity(0.07),
                            theme.accent.opacity(0.10),
                            .clear
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 0.75
                )
                .allowsHitTesting(false)
        }
        .overlay(alignment: .top) {
            Capsule()
                .fill(
                    LinearGradient(
                        colors: [.white.opacity(0.20), .white.opacity(0.02), .clear],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .frame(width: isPad ? 360 : 230, height: 0.7)
                .padding(.top, 2)
                .allowsHitTesting(false)
        }
        .shadow(color: .black.opacity(0.36), radius: isPad ? 28 : 22, y: 11)
        .shadow(color: theme.accent.opacity(0.055), radius: 18, y: 6)
    }

    private var launchOverlay: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            RadialGradient(
                colors: [theme.accent.opacity(0.070), .clear],
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
