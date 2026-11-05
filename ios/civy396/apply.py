"""Civy 3.9.6: native grouped Settings and Apple Music-style bottom glass."""
from pathlib import Path
import sys

root = Path(sys.argv[1])
settings_path = root / "Civy" / "SettingsView.swift"
root_path = root / "Civy" / "RootView.swift"
project_path = root / "Civy.xcodeproj" / "project.pbxproj"

settings = settings_path.read_text()
start = settings.index("struct SettingsView: View {")
end = settings.index("private struct ProfileSettings: View {", start)
new_settings = r'''struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @AppStorage("civy.player.autoplayNext") private var autoPlayNext = false
    @AppStorage("civy.player.resume") private var resume = true
    @AppStorage("civy.player.autoHide") private var autoHide = true
    @AppStorage("civy.player.speed") private var speed = 1.0
    @AppStorage("civy.player.remaining") private var remaining = true
    @AppStorage("civy.streaming.quality") private var quality = "Auto"
    @AppStorage("civy.home.heroRotation") private var rotateArt = true
    @AppStorage("civy.appearance.glass") private var glass = true
    @AppStorage("civy.appearance.motion") private var motion = true
    @AppStorage("civy.appearance.reduceMotion") private var reduceMotion = false
    @AppStorage("civy.appearance.haptics") private var haptics = true
    @AppStorage("civy.subtitles.auto") private var subtitles = false
    @AppStorage("civy.player.stats") private var stats = false
    @AppStorage("civy.home.continue") private var continueWatching = true
    @AppStorage("civy.streaming.autoFailover") private var autoRecovery = true

    var body: some View {
        NavigationStack {
            Form {
                Section("Playback") {
                    Toggle("AutoPlay Next Episode", isOn: $autoPlayNext)
                    Toggle("Resume Playback", isOn: $resume)
                    NavigationLink(value: CivySettingsPage.streaming) {
                        valueRow("Picture Quality", value: quality)
                    }
                    Picker("Playback Speed", selection: $speed) {
                        Text("0.75×").tag(0.75)
                        Text("1×").tag(1.0)
                        Text("1.25×").tag(1.25)
                        Text("1.5×").tag(1.5)
                        Text("2×").tag(2.0)
                    }
                    Toggle("Keep Playing If a Stream Fails", isOn: $autoRecovery)
                    NavigationLink(value: CivySettingsPage.player) {
                        Text("More Playback Options")
                    }
                }

                Section("Video") {
                    Toggle("Rotating Home Artwork", isOn: $rotateArt)
                    Toggle("Liquid Glass Navigation", isOn: $glass)
                    Toggle("Smooth Animations", isOn: $motion)
                    Toggle("Reduce Motion", isOn: $reduceMotion)
                    NavigationLink(value: CivySettingsPage.appearance) {
                        Text("Appearance")
                    }
                }

                Section("Audio & Subtitles") {
                    Toggle("Subtitles by Default", isOn: $subtitles)
                    NavigationLink(value: CivySettingsPage.subtitles) {
                        Text("Subtitle Language & Style")
                    }
                    NavigationLink(value: CivySettingsPage.controls) {
                        Text("Player Controls")
                    }
                }

                Section("My Civy") {
                    Toggle("Continue Watching on Home", isOn: $continueWatching)
                    NavigationLink(value: CivySettingsPage.profile) {
                        Text("Manage Profiles")
                    }
                    NavigationLink(value: CivySettingsPage.library) {
                        Text("My List & Watch History")
                    }
                }

                Section("App") {
                    Toggle("Haptic Feedback", isOn: $haptics)
                    Toggle("Stats for Nerds", isOn: $stats)
                    NavigationLink(value: CivySettingsPage.accessibility) {
                        Text("Accessibility")
                    }
                    NavigationLink(value: CivySettingsPage.connection) {
                        Text("Connection")
                    }
                    NavigationLink(value: CivySettingsPage.storage) {
                        Text("Storage & Privacy")
                    }
                    NavigationLink(value: CivySettingsPage.about) {
                        Text("About Civy Beta")
                    }
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(Color.black.ignoresSafeArea())
            .environment(\.defaultMinListRowHeight, 55)
            .tint(Color.green)
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(Color.synAccent)
                        .padding(.horizontal, 17)
                        .padding(.vertical, 10)
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
                .background(Color.black)
                .tint(Color.synAccent)
            }
        }
        .preferredColorScheme(.dark)
    }

    private func valueRow(_ title: String, value: String) -> some View {
        HStack(spacing: 14) {
            Text(title)
            Spacer(minLength: 10)
            Text(value).foregroundStyle(.secondary)
        }
    }
}

'''
settings = settings[:start] + new_settings + settings[end:]
assert settings.count("struct SettingsView: View {") == 1
assert settings.count('Toggle("AutoPlay Next Episode"') == 1
settings_path.write_text(settings)

root_view = root_path.read_text()
old_dock_slot = '''            CivyFloatingDock(selected: $tab, glass: glass, animate: motion && !reduceMotion)
                .padding(.horizontal, 16)
                .padding(.bottom, 3)
                .zIndex(5)
'''
assert root_view.count(old_dock_slot) == 1
new_dock_slot = '''            VStack(spacing: 9) {
                if let latest = app.history.first, tab != .clips {
                    CivyResumeMiniBar(record: latest)
                        .padding(.horizontal, 17)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
                CivyFloatingDock(selected: $tab, glass: glass, animate: motion && !reduceMotion)
                    .padding(.horizontal, 14)
            }
            .padding(.bottom, 3)
            .zIndex(5)
'''
root_view = root_view.replace(old_dock_slot, new_dock_slot, 1)

dock_marker = "private struct CivyFloatingDock: View {"
assert root_view.count(dock_marker) == 1
mini_bar = r'''// Apple Music-style compact player strip. This is deliberately a Resume
// shortcut, not a fake claim that video audio is playing in the background.
private struct CivyResumeMiniBar: View {
    let record: WatchRecord
    @EnvironmentObject private var app: AppState
    @AppStorage("civy.appearance.haptics") private var haptics = true

    var body: some View {
        Button {
            if haptics { UIImpactFeedbackGenerator(style: .soft).impactOccurred() }
            app.play(record.media, season: record.season, episode: record.episode)
        } label: {
            HStack(spacing: 12) {
                CivyCachedArtwork(url: record.media.posterURL)
                    .frame(width: 39, height: 43)
                    .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 9).strokeBorder(.white.opacity(0.12), lineWidth: 0.6))
                VStack(alignment: .leading, spacing: 3) {
                    Text(record.media.displayTitle)
                        .font(.system(size: 14, weight: .semibold))
                        .lineLimit(1)
                    Text("Continue Watching")
                        .font(.system(size: 12, weight: .regular))
                        .foregroundStyle(.white.opacity(0.66))
                }
                Spacer(minLength: 12)
                Image(systemName: "play.fill")
                    .font(.system(size: 17, weight: .semibold))
                    .frame(width: 43, height: 43)
                    .background(Color.white.opacity(0.11), in: Circle())
                    .accessibilityHidden(true)
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .frame(height: 62)
            .glassEffect(.regular.interactive(), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous)
                .strokeBorder(Color.white.opacity(0.22), lineWidth: 0.7))
            .shadow(color: .black.opacity(0.30), radius: 15, y: 8)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Resume \(record.media.displayTitle)")
    }
}

'''
root_view = root_view.replace(dock_marker, mini_bar + dock_marker, 1)
dock_start = root_view.index(dock_marker)
dock_end = root_view.index("// Display the exact TV-and-waves cast glyph", dock_start)
dock = root_view[dock_start:dock_end]
assert dock.count(".frame(height: 64)") == 1
dock = dock.replace(".frame(height: 64)", ".frame(height: 60)")
dock = dock.replace("Color.white.opacity(glass ? 0.035 : 0.14)", "Color.white.opacity(glass ? 0.015 : 0.14)")
dock = dock.replace(".regular.tint(Color.white.opacity(0.075)).interactive()", ".regular.tint(Color.synAccent.opacity(0.12)).interactive()")
dock = dock.replace("Color.white.opacity(glass ? 0.20 : 0.12)", "Color.white.opacity(glass ? 0.27 : 0.12)")
dock = dock.replace("Color.black.opacity(0.29), radius: 18, y: 9", "Color.black.opacity(0.25), radius: 17, y: 8")
root_view = root_view[:dock_start] + dock + root_view[dock_end:]
assert root_view.count("private struct CivyResumeMiniBar") == 1
root_path.write_text(root_view)

proj = project_path.read_text()
assert proj.count('MARKETING_VERSION = "3.9.5";') == 2
assert proj.count('CURRENT_PROJECT_VERSION = "12";') == 2
proj = proj.replace('MARKETING_VERSION = "3.9.5";', 'MARKETING_VERSION = "3.9.6";')
proj = proj.replace('CURRENT_PROJECT_VERSION = "12";', 'CURRENT_PROJECT_VERSION = "13";')
project_path.write_text(proj)
print("Civy 3.9.6: native grouped Settings, Done button, resume strip and floating Apple Music-style tab bar")
