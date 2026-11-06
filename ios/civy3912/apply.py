"""Civy 3.9.12 flagship pass: simpler Settings, search, responsive Home and My Civy."""
from pathlib import Path
import sys

root = Path(sys.argv[1])
root_file = root / "Civy/RootView.swift"
search_file = root / "Civy/SearchView.swift"
settings_file = root / "Civy/SettingsView.swift"
my_file = root / "Civy/CivyMyCivy.swift"
clips_file = root / "Civy/CivyReels.swift"
project_file = root / "Civy.xcodeproj/project.pbxproj"

new_search = Path(__file__).with_name("SearchView.swift").read_text()
assert new_search.count("struct SearchView: View {") == 1
assert new_search.count("struct MyListView: View {") == 1
assert "civy.search.recentQueries" in new_search
assert "CivySearchScope" in new_search
search_file.write_text(new_search)

# Apple's flagship settings pattern: a few everyday toggles, obvious paths
# to advanced controls, no overwhelming 40-row wall on first entry.
settings = settings_file.read_text()
begin = settings.index("struct SettingsView: View {")
end = settings.index("private struct ProfileSettings: View {", begin)
settings_main = r'''struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @AppStorage("civy.appearance.accentTheme") private var accentTheme = "Blend"
    @AppStorage("civy.startup.enabled") private var startupEnabled = true
    @AppStorage("civy.appearance.reduceMotion") private var reduceMotion = false
    @AppStorage("civy.appearance.haptics") private var haptics = true
    @AppStorage("civy.player.autoplayNext") private var autoplay = false
    @AppStorage("civy.player.resume") private var resume = true
    @AppStorage("civy.streaming.quality") private var quality = "Auto"
    @AppStorage("civy.subtitles.auto") private var subtitles = false
    @AppStorage("civy.home.continue") private var continueWatching = true
    @AppStorage("civy.home.heroRotation") private var rotatingArt = true

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack(spacing: 14) {
                        RoundedRectangle(cornerRadius: 15, style: .continuous)
                            .fill(Color.synBrandGradient)
                            .frame(width: 58, height: 58)
                            .overlay {
                                Text("C")
                                    .font(.system(size: 35, weight: .black, design: .rounded))
                                    .foregroundStyle(.white)
                            }
                        VStack(alignment: .leading, spacing: 5) {
                            Text("Civy Beta")
                                .font(.system(size: 21, weight: .bold))
                            Text("Make your cinema yours.")
                                .font(.system(size: 13))
                                .foregroundStyle(.secondary)
                        }
                        Spacer(minLength: 6)
                    }
                    .padding(.vertical, 6)
                }
                Section("Look & Feel") {
                    Picker("Accent Color", selection: $accentTheme) {
                        Text("Red & Pink").tag("Blend")
                        Text("Cinema Red").tag("Red")
                        Text("Music Pink").tag("Pink")
                    }
                    .accessibilityIdentifier("civy.settings.accent")
                    Toggle("Cinematic Startup", isOn: $startupEnabled)
                    Toggle("Reduce Motion", isOn: $reduceMotion)
                    NavigationLink(value: CivySettingsPage.appearance) {
                        destination("Appearance & Text", symbol: "paintpalette",
                                    description: "Artwork, animations and readability")
                    }
                }
                Section("Watching") {
                    Toggle("AutoPlay Next Episode", isOn: $autoplay)
                    Toggle("Resume Playback", isOn: $resume)
                    NavigationLink(value: CivySettingsPage.streaming) {
                        HStack {
                            Label("Picture Quality", systemImage: "4k.tv")
                            Spacer()
                            Text(quality).foregroundStyle(.secondary)
                        }
                    }
                    Toggle("Subtitles by Default", isOn: $subtitles)
                    NavigationLink(value: CivySettingsPage.player) {
                        destination("Playback Options", symbol: "play.rectangle",
                                    description: "Speed, controls and screen behavior")
                    }
                    NavigationLink(value: CivySettingsPage.subtitles) {
                        Label("Caption Language & Style", systemImage: "captions.bubble")
                    }
                }
                Section("Discover") {
                    Toggle("Continue Watching on Home", isOn: $continueWatching)
                    Toggle("Rotating Featured Artwork", isOn: $rotatingArt)
                    NavigationLink(value: CivySettingsPage.home) {
                        destination("Home & Recommendations", symbol: "sparkles.tv",
                                    description: "Personalized rows and discovery")
                    }
                }
                Section("Your Civy") {
                    NavigationLink(value: CivySettingsPage.profile) {
                        Label("Profiles", systemImage: "person.2.crop.square.stack")
                    }
                    NavigationLink(value: CivySettingsPage.library) {
                        Label("My List & Watch History", systemImage: "bookmark")
                    }
                }
                Section("More") {
                    Toggle("Haptic Feedback", isOn: $haptics)
                    NavigationLink(value: CivySettingsPage.controls) {
                        Label("Player Controls", systemImage: "slider.horizontal.3")
                    }
                    NavigationLink(value: CivySettingsPage.accessibility) {
                        Label("Accessibility", systemImage: "accessibility")
                    }
                    NavigationLink(value: CivySettingsPage.connection) {
                        Label("Connection", systemImage: "wifi")
                    }
                    NavigationLink(value: CivySettingsPage.storage) {
                        Label("Storage & Privacy", systemImage: "externaldrive")
                    }
                    NavigationLink(value: CivySettingsPage.diagnostics) {
                        Label("Diagnostics", systemImage: "waveform.path.ecg")
                    }
                    NavigationLink(value: CivySettingsPage.about) {
                        Label("About Civy", systemImage: "info.circle")
                    }
                }
                Section {
                    HStack {
                        Spacer()
                        Text("Civy Beta · Version 3.9.12")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(.secondary)
                        Spacer()
                    }
                    .listRowBackground(Color.clear)
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(Color.synBackground.ignoresSafeArea())
            .environment(\.defaultMinListRowHeight, 51)
            .tint(Color.synAccent)
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Color.synAccent)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 9)
                        .glassEffect(.regular.interactive(), in: Capsule())
                        .accessibilityIdentifier("settingsDone")
                }
            }
            .navigationDestination(for: CivySettingsPage.self) { page in
                Group {
                    switch page {
                    case .profile: ProfileSettings()
                    case .appearance: AppearanceSettings()
                    case .home: HomeSettings()
                    case .player: PlayerSettings()
                    case .controls: PlaybackControlsSettings()
                    case .subtitles: SubtitleSettings()
                    case .streaming: StreamingSettings()
                    case .diagnostics: DiagnosticsSettings()
                    case .connection: ConnectionSettings()
                    case .library: LibrarySettings()
                    case .accessibility: AccessibilitySettings()
                    case .storage: StorageSettings()
                    case .about: AboutCivySettings()
                    }
                }
                .scrollContentBackground(.hidden)
                .background(Color.synBackground)
                .tint(Color.synAccent)
            }
        }
        .preferredColorScheme(.dark)
    }

    private func destination(_ title: String, symbol: String,
                             description: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: symbol)
                .font(.system(size: 17, weight: .medium))
                .foregroundStyle(Color.synAccent)
                .frame(width: 30)
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .foregroundStyle(.primary)
                Text(description)
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 3)
    }
}

'''
settings = settings[:begin] + settings_main + settings[end:]
assert settings.count("struct SettingsView: View {") == 1
settings_file.write_text(settings)

root_source = root_file.read_text()
root_start = root_source.index("struct RootView: View {")
root_end = root_source.index("private struct CivyCinematicStartup: View {", root_start)
root_body = root_source[root_start:root_end]

state = '''    @State private var showingStartup = true
    @State private var startedStartup = false
'''
assert root_body.count(state) == 1
root_body = root_body.replace(state, state + '''    @AppStorage("civy.startup.enabled") private var startupEnabled = true
    @AppStorage("civy.appearance.reduceMotion") private var reduceMotion = false
''', 1)
root_body = root_body.replace('Tab("Home", systemImage: "house", value: .home)',
                              'Tab("Home", systemImage: tab == .home ? "house.fill" : "house", value: .home', 1) if False else root_body
# Keep the iOS 26 native navigation animations and selection; prefer filled
# selected icons for visual clarity.
for old, new in [
    ('Tab("Home", systemImage: "house", value: .home)',
     'Tab("Home", systemImage: tab == .home ? "house.fill" : "house", value: .home)'),
    ('Tab("Clips", systemImage: "play.square.stack", value: .clips)',
     'Tab("Clips", systemImage: tab == .clips ? "play.square.stack.fill" : "play.square.stack", value: .clips)'),
    ('Tab("My Civy", systemImage: "person.crop.circle", value: .mine)',
     'Tab("My Civy", systemImage: tab == .mine ? "person.crop.circle.fill" : "person.crop.circle", value: .mine)')
]:
    assert root_body.count(old) == 1, old
    root_body = root_body.replace(old, new, 1)

old = '''            if showingStartup {
                CivyCinematicStartup()
                    .transition(.opacity)'''
new = '''            if showingStartup && startupEnabled && !reduceMotion {
                CivyCinematicStartup()
                    .contentShape(Rectangle())
                    .onTapGesture {
                        withAnimation(.easeOut(duration: 0.18)) { showingStartup = false }
                    }
                    .transition(.opacity)'''
assert root_body.count(old) == 1
root_body = root_body.replace(old, new, 1)
old = '''            try? await Task.sleep(for: .milliseconds(2150))
            withAnimation(.easeOut(duration: 0.42)) {
                showingStartup = false
            }'''
new = '''            if startupEnabled && !reduceMotion {
                try? await Task.sleep(for: .milliseconds(1720))
            }
            withAnimation(.easeOut(duration: reduceMotion ? 0.1 : 0.32)) {
                showingStartup = false
            }'''
assert root_body.count(old) == 1
root_body = root_body.replace(old, new, 1)
root_source = root_source[:root_start] + root_body + root_source[root_end:]

home_start = root_source.index("struct HomeView: View {")
home_end = root_source.index("private extension Optional", home_start)
home = root_source[home_start:home_end]
old = '                            .padding(.top, 31)'
new = '                            .padding(.top, verticalSizeClass == .compact ? 14 : 31)'
assert home.count(old) == 1
home = home.replace(old, new, 1)
old = '''    private func changeFilter(_ next: BrowseFilter) {
        let to = filter == next ? BrowseFilter.all : next'''
new = '''    private func changeFilter(_ next: BrowseFilter) {
        if haptics { UISelectionFeedbackGenerator().selectionChanged() }
        let to = filter == next ? BrowseFilter.all : next'''
assert home.count(old) == 1
home = home.replace(old, new, 1)
old = '''    @AppStorage("civy.appearance.reduceMotion") private var reduceMotion = false'''
assert home.count(old) == 1
home = home.replace(old, old + '''
    @AppStorage("civy.appearance.haptics") private var haptics = true''', 1)
tb_begin = home.index("    private var topBar: some View {")
tb_end = home.index("    private var filterBar: some View {", tb_begin)
tb = home[tb_begin:tb_end]
# Compact navigation should never take a portrait-height row in landscape.
assert tb.count('.frame(height: 54)') == 1
tb = tb.replace('.frame(height: 54)', '.frame(height: verticalSizeClass == .compact ? 43 : 54)', 1)
home = home[:tb_begin] + tb + home[tb_end:]
root_source = root_source[:home_start] + home + root_source[home_end:]

hero_start = root_source.index("private struct CivyPosterHero: View {")
hero_end = root_source.index("// MARK: - Bottom destinations", hero_start)
hero = root_source[hero_start:hero_end]
assert hero.count('.aspectRatio(verticalSizeClass == .compact ? 1.85 : 0.705, contentMode: .fit)') == 1
hero = hero.replace('.aspectRatio(verticalSizeClass == .compact ? 1.85 : 0.705, contentMode: .fit)',
                    '.aspectRatio(verticalSizeClass == .compact ? 2.45 : 0.705, contentMode: .fit)', 1)
root_source = root_source[:hero_start] + hero + root_source[hero_end:]
assert "CivyCinematicStartup" in root_source
assert "civy.startup.enabled" in root_source
root_file.write_text(root_source)

my = my_file.read_text()
old = '''    @EnvironmentObject private var viewers: CivyViewerStore'''
assert my.count(old) == 1
my = my.replace(old, old + '''
    @Environment(\.verticalSizeClass) private var verticalSizeClass''', 1)
old = '''                    VStack(alignment: .leading, spacing: 29) {'''
assert my.count(old) == 1
my = my.replace(old, '''                    VStack(alignment: .leading, spacing: verticalSizeClass == .compact ? 18 : 29) {''', 1)
old = '''                    .padding(.bottom, 130)
                }'''
assert my.count(old) == 1
my = my.replace(old, '''                    .padding(.bottom, 130)
                    .frame(maxWidth: 1040)
                    .frame(maxWidth: .infinity)
                }''', 1)
old = '''                    Text("S")
                        .font(.system(size: 33, weight: .black, design: .rounded))'''
assert my.count(old) == 1
my = my.replace(old, '''                    Text("C")
                        .font(.system(size: 33, weight: .black, design: .rounded))''', 1)
for old, new in [
    ('.padding(.top, 59)', '.padding(.top, verticalSizeClass == .compact ? 14 : 59)'),
    ('Spacer(minLength: 75)', 'Spacer(minLength: verticalSizeClass == .compact ? 15 : 75)'),
    ('.frame(height: 350)', '.frame(height: verticalSizeClass == .compact ? 250 : 350)')
]:
    assert my.count(old) == 1, old
    my = my.replace(old, new, 1)
my_file.write_text(my)

clips = clips_file.read_text()
old = '''                if clips.isEmpty {
                    VStack(spacing: 15) {
                        ProgressView().tint(Color.synAccent)
                        Text("Finding trailers…").font(.system(size: 16, weight: .medium))
                    }
                } else {'''
new = '''                if clips.isEmpty {
                    VStack(spacing: 16) {
                        if app.home == nil && app.isLoadingHome {
                            ProgressView().tint(Color.synAccent)
                            Text("Finding trailers…")
                                .font(.system(size: 16, weight: .medium))
                        } else {
                            Image(systemName: "play.rectangle.on.rectangle")
                                .font(.system(size: 37, weight: .ultraLight))
                                .foregroundStyle(Color.synAccent)
                            Text("No trailers to show")
                                .font(.system(size: 20, weight: .semibold))
                            Text("Check your connection, then try again.")
                                .font(.system(size: 14))
                                .foregroundStyle(.secondary)
                            Button("Try Again") {
                                Task { await app.loadHome() }
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(Color.synAccent)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, 20)
                } else {'''
assert clips.count(old) == 1
clips = clips.replace(old, new, 1)
clips_file.write_text(clips)
assert "PeerTube" not in clips and "sepiasearch" not in clips.lower()

project = project_file.read_text()
assert project.count('MARKETING_VERSION = "3.9.11";') == 2
assert project.count('CURRENT_PROJECT_VERSION = "18";') == 2
project = project.replace('MARKETING_VERSION = "3.9.11";',
                          'MARKETING_VERSION = "3.9.12";')
project = project.replace('CURRENT_PROJECT_VERSION = "18";',
                          'CURRENT_PROJECT_VERSION = "19";')
project_file.write_text(project)
print("Civy 3.9.12 flagship: refined Settings, recent search, adaptive Home/My Civy, improved Clips and skippable startup")
