"""Civy 3.9.9 Beta: usable native Settings and signature red-to-pink identity."""
from pathlib import Path
import sys

root = Path(sys.argv[1])
design = root / "Civy" / "Design.swift"
settings = root / "Civy" / "SettingsView.swift"
root_view = root / "Civy" / "RootView.swift"
mycivy = root / "Civy" / "CivyMyCivy.swift"
project = root / "Civy.xcodeproj" / "project.pbxproj"

# A single live accent source shared by navigation, titles, player and buttons.
d = design.read_text()
original = '''    static let background = Color(red: 0.022, green: 0.022, blue: 0.026)
    static let surface = Color(red: 0.075, green: 0.074, blue: 0.082)
    static let elevated = Color(red: 0.13, green: 0.125, blue: 0.135)
    static let muted = Color(red: 0.66, green: 0.66, blue: 0.69)
    static let accent = Color(red: 0.898, green: 0.035, blue: 0.078)'''
replacement = '''    static let background = Color(red: 0.025, green: 0.014, blue: 0.025)
    static let surface = Color(red: 0.080, green: 0.045, blue: 0.067)
    static let elevated = Color(red: 0.145, green: 0.088, blue: 0.120)
    static let muted = Color(red: 0.70, green: 0.64, blue: 0.69)
    static let red = Color(red: 0.90, green: 0.035, blue: 0.078)
    static let pink = Color(red: 0.985, green: 0.185, blue: 0.455)
    static var accent: Color {
        let theme = UserDefaults.standard.string(forKey: "civy.appearance.accentTheme") ?? "Blend"
        switch theme {
        case "Red": return red
        case "Pink": return pink
        default: return Color(red: 0.965, green: 0.105, blue: 0.245)
        }
    }'''
assert d.count(original) == 1, "Design palette changed"
d = d.replace(original, replacement)
anchor = '    static var synAccent: Color { Design.accent }\n'
assert d.count(anchor) == 1
d = d.replace(anchor, anchor + '''    static var synRed: Color { Design.red }
    static var synPink: Color { Design.pink }
    static var synBrandGradient: LinearGradient {
        LinearGradient(
            colors: [.synRed, .synAccent, .synPink],
            startPoint: .leading,
            endPoint: .trailing
        )
    }
''', 1)
design.write_text(d)

# Keep native grouped settings; all these keys are consumed by existing views
# and their detailed Settings pages (not dummy/demo toggles).
s = settings.read_text()
begin = s.index("struct SettingsView: View {")
end = s.index("private struct ProfileSettings: View {", begin)
part = s[begin:end]
old = '''    @AppStorage("civy.streaming.autoFailover") private var autoRecovery = true
'''
assert part.count(old) == 1
part = part.replace(old, old + '''    @AppStorage("civy.appearance.accentTheme") private var accentTheme = "Blend"
    @AppStorage("civy.appearance.borders") private var posterBorders = true
    @AppStorage("civy.appearance.posterLabels") private var posterLabels = false
    @AppStorage("civy.appearance.largeArtwork") private var largeArtwork = true
    @AppStorage("civy.home.showScore") private var ratings = true
    @AppStorage("civy.home.editorial") private var editorial = true
    @AppStorage("civy.home.curated") private var curated = true
    @AppStorage("civy.home.personalized") private var recommendations = true
    @AppStorage("civy.player.keepAwake") private var keepAwake = true
    @AppStorage("civy.player.aspectFill") private var fillScreen = false
    @AppStorage("civy.player.tapControls") private var tapControls = true
    @AppStorage("civy.player.hideDelay") private var hideDelay = 4
    @AppStorage("civy.player.skip") private var skipSeconds = 10
    @AppStorage("civy.streaming.dataSaver") private var dataSaver = false
    @AppStorage("civy.streaming.lowLatency") private var lowLatency = false
    @AppStorage("civy.appearance.largeText") private var largeText = false
    @AppStorage("civy.player.largerButtons") private var largerButtons = false
    @AppStorage("civy.subtitles.language") private var subtitleLanguage = "en"
''', 1)

start = part.index('            Form {\n')
stop = part.index('            }\n            .listStyle(.insetGrouped)', start)
new_groups = '''            Form {
                Section {
                    HStack(spacing: 12) {
                        RoundedRectangle(cornerRadius: 13, style: .continuous)
                            .fill(Color.synBrandGradient)
                            .frame(width: 42, height: 42)
                            .overlay {
                                Image(systemName: "play.fill")
                                    .font(.system(size: 18, weight: .semibold))
                                    .foregroundStyle(.white)
                            }
                        VStack(alignment: .leading, spacing: 3) {
                            Text("Civy Beta")
                                .font(.system(size: 17, weight: .semibold))
                            Text("Personalize your cinema")
                                .font(.system(size: 12))
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        HStack(spacing: -5) {
                            Circle().fill(Color.synRed)
                            Circle().fill(Color.synPink)
                        }
                        .frame(width: 42, height: 25)
                    }
                    .padding(.vertical, 3)
                }
                Section("Appearance") {
                    Picker("Accent Color", selection: $accentTheme) {
                        Text("Red & Pink").tag("Blend")
                        Text("Cinema Red").tag("Red")
                        Text("Music Pink").tag("Pink")
                    }
                    .accessibilityIdentifier("civy.accentTheme")
                    Toggle("Smooth Animations", isOn: $motion)
                    Toggle("Reduce Motion", isOn: $reduceMotion)
                    Toggle("Larger Text", isOn: $largeText)
                    NavigationLink(value: CivySettingsPage.appearance) {
                        Text("More Appearance Options")
                    }
                }
                Section("Playback") {
                    Toggle("AutoPlay Next Episode", isOn: $autoPlayNext)
                    Toggle("Resume Where I Left Off", isOn: $resume)
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
                    Toggle("Keep Screen Awake", isOn: $keepAwake)
                    Toggle("Tap for Player Controls", isOn: $tapControls)
                    Toggle("Keep Playing If a Stream Fails", isOn: $autoRecovery)
                    NavigationLink(value: CivySettingsPage.player) {
                        Text("Advanced Playback")
                    }
                }
                Section("Home & Discovery") {
                    Toggle("Continue Watching", isOn: $continueWatching)
                    Toggle("Rotating Movie Artwork", isOn: $rotateArt)
                    Toggle("Personalized Rows", isOn: $recommendations)
                    Toggle("Editorial Picks", isOn: $editorial)
                    Toggle("Curated Collections", isOn: $curated)
                    Toggle("Movie Ratings", isOn: $ratings)
                    Toggle("Show Poster Titles", isOn: $posterLabels)
                    NavigationLink(value: CivySettingsPage.home) {
                        Text("More Home Options")
                    }
                }
                Section("Video & Data") {
                    Toggle("Fill Screen", isOn: $fillScreen)
                    Toggle("Large Artwork", isOn: $largeArtwork)
                    Toggle("Poster Borders", isOn: $posterBorders)
                    Toggle("Data Saver", isOn: $dataSaver)
                    Toggle("Low Latency", isOn: $lowLatency)
                    NavigationLink(value: CivySettingsPage.streaming) {
                        Text("Network & Buffering")
                    }
                }
                Section("Subtitles & Controls") {
                    Toggle("Show Subtitles by Default", isOn: $subtitles)
                    NavigationLink(value: CivySettingsPage.subtitles) {
                        Text("Caption Language & Style")
                    }
                    Picker("Skip Duration", selection: $skipSeconds) {
                        Text("5 seconds").tag(5)
                        Text("10 seconds").tag(10)
                        Text("15 seconds").tag(15)
                        Text("30 seconds").tag(30)
                    }
                    Toggle("Larger Player Buttons", isOn: $largerButtons)
                    NavigationLink(value: CivySettingsPage.controls) {
                        Text("More Player Controls")
                    }
                }
                Section("My Civy") {
                    NavigationLink(value: CivySettingsPage.profile) {
                        Text("Manage Profiles")
                    }
                    NavigationLink(value: CivySettingsPage.library) {
                        Text("My List & Watch History")
                    }
                }
                Section("App & Privacy") {
                    Toggle("Haptic Feedback", isOn: $haptics)
                    Toggle("Stats for Nerds", isOn: $stats)
                    NavigationLink(value: CivySettingsPage.accessibility) {
                        Text("Accessibility")
                    }
                    NavigationLink(value: CivySettingsPage.connection) {
                        Text("Connection Status")
                    }
                    NavigationLink(value: CivySettingsPage.storage) {
                        Text("Storage & Privacy")
                    }
                    NavigationLink(value: CivySettingsPage.about) {
                        Text("About Civy Beta")
                    }
                }
                Section {
                    HStack {
                        Spacer()
                        Text("Civy Beta · Version 3.9.9")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(.secondary)
                        Spacer()
                    }
                    .listRowBackground(Color.clear)
                }
'''
part = part[:start] + new_groups + part[stop:]
part = part.replace('            .tint(Color.green)\n', '            .tint(Color.synAccent)\n', 1)
assert part.count('Section("Appearance")') == 1
assert part.count('Section("Home & Discovery")') == 1
assert part.count('Section("Playback")') == 1
assert part.count('Section("App & Privacy")') == 1
assert part.count('Civy Beta · Version 3.9.9') == 1
s = s[:begin] + part + s[end:]
settings.write_text(s)

# Recompute theme in the native TabView as soon as user changes it.
r = root_view.read_text()
old = '''    @State private var tab: CivyTab = .home
'''
assert r.count(old) == 1
r = r.replace(old, old + '''    @AppStorage("civy.appearance.accentTheme") private var accentTheme = "Blend"
''', 1)
# Native tab bar and search lens pick up the newly selected accent automatically.
assert r.count('        .tint(Color.synAccent)\n') >= 1
root_view.write_text(r)

# Subtle dual-tone cinematic treatment for My Civy backdrop and badges.
m = mycivy.read_text()
old = '''            Text("S")
'''
# This is only the tiny Civy mark. Keep the rest readable.
assert m.count(old) == 1
m = m.replace('''                        .foregroundStyle(Color.synAccent)
                    Text("My Civy")''',
'''                        .foregroundStyle(Color.synBrandGradient)
                    Text("My Civy")''', 1) if False else m
# Make the profile header's rose/plum gradient a little livelier.
m = m.replace('''Color(red: 0.23, green: 0.025, blue: 0.05)''',
'''Color(red: 0.31, green: 0.028, blue: 0.105)''')
m = m.replace('''Color(red: 0.095, green: 0.025, blue: 0.042)''',
'''Color(red: 0.125, green: 0.036, blue: 0.091)''')
mycivy.write_text(m)

p = project.read_text()
assert p.count('MARKETING_VERSION = "3.9.8";') == 2
assert p.count('CURRENT_PROJECT_VERSION = "15";') == 2
p = p.replace('MARKETING_VERSION = "3.9.8";', 'MARKETING_VERSION = "3.9.9";')
p = p.replace('CURRENT_PROJECT_VERSION = "15";', 'CURRENT_PROJECT_VERSION = "16";')
project.write_text(p)
print("Civy 3.9.9: red/pink theme, native Settings expansion, dynamic brand accent and iOS 26 native tab bar")
