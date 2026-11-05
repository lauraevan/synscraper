"""Civy 3.9.8: use Apple's native iOS 26 sliding Liquid Glass TabView.

Unlike the previous overlay navigation, TabView automatically animates the
selection lens between tabs, pins Search as a separate circular tab, and
minimizes into the selected icon when scrolling down.
"""
from pathlib import Path
import sys

root = Path(sys.argv[1])
root_file = root / "Civy" / "RootView.swift"
settings_file = root / "Civy" / "SettingsView.swift"
project_file = root / "Civy.xcodeproj" / "project.pbxproj"

text = root_file.read_text()
start = text.index("struct RootView: View {")
end = text.index("private struct CivyResumeMiniBar: View {", start)
native_root = r'''struct RootView: View {
    @EnvironmentObject private var app: AppState
    @StateObject private var viewers = CivyViewerStore()
    @State private var tab: CivyTab = .home

    // All of the tab bar's glass, selection morphing, and scroll minimizing
    // are owned by iOS 26 instead of approximated with a custom overlay.
    var body: some View {
        TabView(selection: $tab) {
            Tab("Home", systemImage: "house", value: .home) {
                HomeView()
            }
            Tab("Live", systemImage: "dot.radiowaves.left.and.right", value: .live) {
                CivyLiveView()
            }
            Tab("Clips", systemImage: "play.square.stack", value: .clips) {
                CivyClipsView()
            }
            Tab("My Civy", systemImage: "person.crop.circle", value: .mine) {
                CivyMyCivyView()
            }
            // The search role pins a circular glass Search tab outside
            // the main capsule, including in the minimized state.
            Tab(value: .search, role: .search) {
                SearchView()
            }
        }
        .tabBarMinimizeBehavior(.onScrollDown)
        .tabViewBottomAccessory {
            // The Continue Watching strip occupies the real system
            // accessory slot; it is absent without actual watch history.
            if tab != .clips, let latest = app.history.first {
                CivyResumeMiniBar(record: latest)
                    .padding(.horizontal, 8)
            }
        }
        .tint(Color.synAccent)
        .fontDesign(.default)
        .environmentObject(viewers)
        .fullScreenCover(isPresented: $viewers.choosing) {
            CivyWhoIsWatching()
                .environmentObject(viewers)
                .environmentObject(app)
        }
        .fullScreenCover(item: $app.playbackRequest) { request in
            PlayerScreen(request: request)
                .id(request.id)
                .environmentObject(app)
        }
        .accessibilityIdentifier("civy.nativeSlidingGlassTabBar")
    }
}

'''
text = text[:start] + native_root + text[end:]

# Delete the old custom bar to avoid two competing tab-bar implementations.
dock_start = text.index("private struct CivyFloatingDock: View {")
dock_end = text.index("\n}\n\n", dock_start) + len("\n}\n\n")
text = text[:dock_start] + text[dock_end:]
assert "private struct CivyFloatingDock" not in text
assert text.count("TabView(selection: $tab)") == 1
assert text.count(".tabBarMinimizeBehavior(.onScrollDown)") == 1
assert text.count("Tab(value: .search, role: .search)") == 1
assert text.count(".tabViewBottomAccessory {") == 1
assert text.count("civy.nativeSlidingGlassTabBar") == 1
root_file.write_text(text)

# Remove a misleading toggle: native system tab-bar glass cannot be switched
# off by the old custom-overlay preference. All other functional settings stay.
settings = settings_file.read_text()
old = '                    Toggle("Liquid Glass Navigation", isOn: $glass)\n'
assert settings.count(old) == 1
settings = settings.replace(old, "", 1)
old = 'Civy Beta · Version 3.9.7'
assert settings.count(old) == 1
settings = settings.replace(old, 'Civy Beta · Version 3.9.8', 1)
settings_file.write_text(settings)

project = project_file.read_text()
assert project.count('MARKETING_VERSION = "3.9.7";') == 2
assert project.count('CURRENT_PROJECT_VERSION = "14";') == 2
project = project.replace('MARKETING_VERSION = "3.9.7";', 'MARKETING_VERSION = "3.9.8";')
project = project.replace('CURRENT_PROJECT_VERSION = "14";', 'CURRENT_PROJECT_VERSION = "15";')
project_file.write_text(project)
print("Civy 3.9.8: native glass selection morph, separate Search, scroll-to-minimize, integrated resume accessory")
