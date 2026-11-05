"""Civy 3.9.3 flagship player and Settings UI. Applied after 3.9.2."""
from pathlib import Path
import sys

root = Path(sys.argv[1])
player = root / "Civy" / "PlayerScreen.swift"
settings = root / "Civy" / "SettingsView.swift"
project = root / "Civy.xcodeproj" / "project.pbxproj"

s = player.read_text()

def replace_once(old, new):
    global s
    count = s.count(old)
    assert count == 1, f"Player anchor count {count}: {old[:100]!r}"
    s = s.replace(old, new, 1)

# Miami/Vidy supplies multiple real resolution-specific entries. Those belong
# under Quality, not separate top-level servers. Keep HLS masters as well.
anchor = '    var currentCaption: String? {\n'
quality_logic = '''    private static func serverKey(_ stream: StreamServer) -> String {
        "\\(stream.provider ?? "unknown")::\\(stream.name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased())"
    }

    private static func parsedResolution(_ text: String?) -> String? {
        let raw = (text ?? "").lowercased()
        if raw.contains("4k") || raw.contains("uhd") { return "2160p" }
        for height in [2160, 1440, 1080, 720, 480, 360, 240] {
            if raw.contains("\\(height)") { return "\\(height)p" }
        }
        return nil
    }

    var serverChoices: [Int] {
        var seen = Set<String>()
        return sources.indices.filter { seen.insert(Self.serverKey(sources[$0])).inserted }
    }

    var selectedServerNumber: Int {
        guard let currentSource else { return 1 }
        let key = Self.serverKey(currentSource)
        return (serverChoices.firstIndex(where: { Self.serverKey(sources[$0]) == key }) ?? 0) + 1
    }

    var qualityChoices: [String] {
        guard let currentSource else { return [] }
        let key = Self.serverKey(currentSource)
        var heights = Set(qualityLevels.map(\\.label))
        for source in sources where Self.serverKey(source) == key {
            if let label = Self.parsedResolution(source.quality ?? source.name) {
                heights.insert(label)
            }
        }
        return heights.sorted { (Int($0.dropLast()) ?? 0) > (Int($1.dropLast()) ?? 0) }
    }

    var effectiveQuality: String {
        if selectedQuality != "Auto" { return selectedQuality }
        return Self.parsedResolution(currentSource?.quality) ?? "Auto"
    }

    var qualityDescription: String {
        if qualityChoices.isEmpty { return "Server-controlled quality" }
        return "\\(qualityChoices.count) available resolution\\(qualityChoices.count == 1 ? "" : "s")"
    }

'''
replace_once(anchor, quality_logic + anchor)
old = '''    func chooseQuality(_ label: String) {
        guard let index = selectedIndex else { return }
        if label == "Auto" { selectSource(at: index) }
        else if let variant = qualityLevels.first(where: { $0.label == label }) {
            selectSource(at: index, quality: variant)
        }
    }
'''
new = '''    func chooseQuality(_ label: String) {
        guard let index = selectedIndex, let currentSource else { return }
        let key = Self.serverKey(currentSource)
        if label == "Auto" {
            // Auto returns to the first/best available stream of the *same*
            // server, never to a different provider or a new server selection.
            let first = serverChoices.first(where: { Self.serverKey(sources[$0]) == key }) ?? index
            if first == index && selectedQuality == "Auto" { return }
            selectSource(at: first)
            return
        }
        // Prefer a rendition from the current HLS master.
        if let variant = qualityLevels.first(where: { $0.label == label }) {
            if selectedQuality == label { return }
            selectSource(at: index, quality: variant)
            return
        }
        // Vidy Miami, among others, returns one stream per resolution.
        // It stays the same named server in the UI, even if the URL changes.
        if let sibling = sources.indices.first(where: {
            Self.serverKey(sources[$0]) == key &&
            Self.parsedResolution(sources[$0].quality ?? sources[$0].name) == label
        }) {
            if sibling == index && selectedQuality == label { return }
            selectSource(at: sibling)
            selectedQuality = label
        }
    }
'''
replace_once(old,new)

replace_once('Connecting to Server \\(playback.selectedIndex.map { $0 + 1 } ?? 1)…',
             'Connecting to Server \\(playback.selectedServerNumber)…')

replace_once('value: playback.selectedQuality == "Auto" ? (playback.currentSource?.quality ?? "Auto") : playback.selectedQuality',
             'value: playback.selectedQuality == "Auto" ? "Auto" : playback.effectiveQuality')
replace_once('value: "Server \\((playback.selectedIndex ?? 0) + 1)"',
             'value: "Server \\(playback.selectedServerNumber)"')

start = s.index('        case .quality:\n            settingChoice("Auto"')
end = s.index('        case .sleep:', start)
s = s[:start] + '''        case .quality:
            VStack(alignment: .leading, spacing: 6) {
                Text("PICTURE QUALITY")
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .tracking(1.5).foregroundStyle(.white.opacity(0.54))
                Text(playback.currentSource?.name ?? "Current server")
                    .font(.system(size: 15, weight: .medium))
                Text("Change the resolution right here. Your server stays selected and playback resumes where you left off.")
                    .font(.system(size: 13))
                    .foregroundStyle(.white.opacity(0.60))
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, 16).padding(.vertical, 14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .glassEffect(.regular.tint(Color.synAccent.opacity(0.09)), in: RoundedRectangle(cornerRadius: 18))
            .padding(.bottom, 10)
            settingChoice("Automatic", subtitle: "Use adaptive playback or the best available stream",
                          selected: playback.selectedQuality == "Auto") {
                playback.chooseQuality("Auto")
                settingsPage = .main
            }
            ForEach(playback.qualityChoices, id: \\.self) { label in
                settingChoice(label,
                              subtitle: "Available on \\(playback.currentSource?.name ?? "this server")",
                              selected: playback.selectedQuality == label) {
                    playback.chooseQuality(label)
                    if haptics { UISelectionFeedbackGenerator().selectionChanged() }
                    settingsPage = .main
                }
            }
            if playback.qualityChoices.isEmpty {
                Label("This stream provides no switchable resolutions. The server controls its output quality.",
                      systemImage: "info.circle")
                    .font(.system(size: 13))
                    .foregroundStyle(.white.opacity(0.65))
                    .padding(.horizontal, 16).padding(.vertical, 17)
            }
            if playback.renderedHeight > 0 {
                Label("Now playing at \\(playback.renderedWidth) × \\(playback.renderedHeight)", systemImage: "display")
                    .font(.system(size: 12))
                    .foregroundStyle(.white.opacity(0.68))
                    .padding(.horizontal, 16).padding(.top, 8)
            }
''' + s[end:]

start = s.index('        case .sources:\n            if playback.sources.isEmpty')
end = s.index('        case .cast:',start)
s = s[:start] + '''        case .sources:
            Text("Choose a provider. Resolutions for the selected provider, including Miami, appear under Quality.")
                .font(.system(size: 13))
                .foregroundStyle(.white.opacity(0.62))
                .padding(.horizontal, 14).padding(.bottom, 12)
            if playback.serverChoices.isEmpty {
                Text("No playback servers are available right now.")
                    .foregroundStyle(.white.opacity(0.7)).padding(.vertical, 15)
            }
            ForEach(Array(playback.serverChoices.enumerated()), id: \\.offset) { number, index in
                let source = playback.sources[index]
                settingChoice("Server \\(number + 1)",
                              subtitle: "\\(source.name) · \\(source.provider ?? "stream")",
                              selected: playback.currentSource?.name == source.name &&
                                        playback.currentSource?.provider == source.provider) {
                    isWebPlayback = false
                    playback.selectSource(at: index)
                    settingsPage = .main
                }
            }
''' + s[end:]

# Replace bulky settings modal with edge-to-edge video-blur surface and
# restrained Liquid Glass row highlights, like the user's player screenshot.
start = s.index('    private func playerSettingsOverlay(isWide: Bool) -> some View {')
end = s.index('    @ViewBuilder\n    private var playerSettingsContent:', start)
s = s[:start] + '''    private func playerSettingsOverlay(isWide: Bool) -> some View {
        GeometryReader { geo in
            ZStack {
                Rectangle()
                    .fill(.ultraThinMaterial)
                    .opacity(0.45)
                    .ignoresSafeArea()
                Color.black.opacity(0.68).ignoresSafeArea()
                    .onTapGesture { closeSettings() }
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        HStack(spacing: 12) {
                            if settingsPage != .main {
                                Button {
                                    withAnimation(.snappy(duration: 0.24)) { settingsPage = .main }
                                } label: {
                                    Image(systemName: "chevron.left")
                                        .font(.system(size: 20, weight: .semibold))
                                        .frame(width: 44, height: 44)
                                        .glassEffect(.regular.interactive(), in: Circle())
                                }
                                .accessibilityLabel("Back")
                            }
                            VStack(alignment: .leading, spacing: 3) {
                                Text(settingsTitle)
                                    .font(.system(size: isWide ? 28 : 26, weight: .bold, design: .default))
                                    .tracking(-0.7)
                                if settingsPage == .main {
                                    Text("Make your viewing experience yours")
                                        .font(.system(size: 13))
                                        .foregroundStyle(.white.opacity(0.58))
                                }
                            }
                            Spacer()
                            Button { closeSettings() } label: {
                                Image(systemName: "xmark")
                                    .font(.system(size: 22, weight: .medium))
                                    .frame(width: 48, height: 48)
                                    .glassEffect(.regular.interactive(), in: Circle())
                            }
                            .accessibilityLabel("Close settings")
                        }
                        .padding(.bottom, 5)
                        GlassEffectContainer(spacing: 9) {
                            VStack(alignment: .leading, spacing: 2) {
                                playerSettingsContent
                            }
                        }
                    }
                    .foregroundStyle(.white)
                    .padding(.vertical, isWide ? 28 : 60)
                    .padding(.horizontal, 18)
                    .frame(maxWidth: isWide ? 760 : 520)
                    .frame(maxWidth: .infinity, alignment: .center)
                }
                .scrollIndicators(.hidden)
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
    }

''' + s[end:]

# Cleaner rows and glass highlight, not fake frosted white slabs.
start = s.index('    private func settingRow(_ title: String, icon: String, value: String?,')
end = s.index('    private func playerIcon(',start)
s = s[:start] + '''    private func settingRow(_ title: String, icon: String, value: String?, detail: String? = nil, action: @escaping () -> Void) -> some View {
        Button {
            if haptics { UISelectionFeedbackGenerator().selectionChanged() }
            withAnimation(.smooth(duration: 0.22)) { action() }
        } label: {
            HStack(alignment: .center, spacing: 15) {
                Image(systemName: icon)
                    .font(.system(size: 21, weight: .light))
                    .frame(width: 34)
                    .foregroundStyle(.white.opacity(0.96))
                VStack(alignment: .leading, spacing: 3) {
                    Text(title).font(.system(size: 17, weight: .semibold))
                    if let detail {
                        Text(detail)
                            .font(.system(size: 12))
                            .foregroundStyle(.white.opacity(0.53))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                Spacer(minLength: 8)
                if let value {
                    Text(value)
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(.white.opacity(0.68))
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.41))
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .frame(minHeight: 57)
            .contentShape(RoundedRectangle(cornerRadius: 15))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(.isButton)
    }

    private func settingChoice(_ title: String, subtitle: String?, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 14) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.system(size: 17, weight: selected ? .bold : .medium))
                    if let subtitle {
                        Text(subtitle)
                            .font(.system(size: 12))
                            .foregroundStyle(.white.opacity(0.61))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                Spacer(minLength: 10)
                if selected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 20))
                        .foregroundStyle(Color.synAccent)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 13)
            .frame(minHeight: 54)
            .background {
                if selected {
                    RoundedRectangle(cornerRadius: 17, style: .continuous)
                        .fill(Color.synAccent.opacity(0.11))
                }
            }
            .glassEffect(selected ? .regular.interactive() : .identity,
                         in: RoundedRectangle(cornerRadius: 17, style: .continuous))
            .contentShape(RoundedRectangle(cornerRadius: 17))
        }
        .buttonStyle(.plain)
    }

''' + s[end:]

# Remove confusing old quality-based source rearrangement so server numbering is stable.
old = '''            let preference = UserDefaults.standard.string(forKey: "civy.streaming.quality") ?? "Auto"
            if preference == "Auto" { sources = resolved }
            else {
                let priority: (StreamServer) -> Int = { stream in
                    let quality = (stream.quality ?? "").lowercased()
                    return quality.contains(preference.lowercased()) ? 0 : 1
                }
                sources = resolved.sorted { priority($0) < priority($1) }
            }
'''
assert old in s
s = s.replace(old, '            sources = resolved\n', 1)

# Defensive: cap direct quality choices to media URLs belonging to returned sources.
assert 'func chooseQuality(_ label: String)' in s
assert 'Miami' in s
player.write_text(s)

# App-wide Settings: refine nav style, translucent section cards and
# hero presentation while retaining existing functional setting pages.
a = settings.read_text()
assert a.count('NavigationStack {') >= 1
a = a.replace('''                Color.synBackground.ignoresSafeArea()
                RadialGradient(colors: [Color.synAccent.opacity(0.14), .clear], center: .topLeading, startRadius: 25, endRadius: 450)
                    .ignoresSafeArea().allowsHitTesting(false)''',
'''                Color.black.ignoresSafeArea()
                LinearGradient(colors: [
                    Color(red: 0.23, green: 0.025, blue: 0.05),
                    Color(red: 0.095, green: 0.025, blue: 0.042),
                    .black,
                    .black
                ], startPoint: .topLeading, endPoint: .bottomTrailing)
                .ignoresSafeArea().allowsHitTesting(false)
                Circle().fill(Color.synAccent.opacity(0.17))
                    .frame(width: 320, height: 320)
                    .blur(radius: 100)
                    .offset(x: 190, y: -180)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                    .ignoresSafeArea().allowsHitTesting(false)''', 1)
a = a.replace('''                    VStack(alignment: .leading, spacing: 26) {
                        hero''',
'''                    VStack(alignment: .leading, spacing: 26) {
                        HStack(alignment: .firstTextBaseline) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("YOUR CINEMA")
                                    .font(.system(size: 11, weight: .bold))
                                    .tracking(2.2)
                                    .foregroundStyle(Color.synAccent)
                                Text("Make it yours.")
                                    .font(.system(size: 32, weight: .bold))
                                    .tracking(-1.2)
                            }
                            Spacer()
                            Text("BETA")
                                .font(.system(size: 11, weight: .bold))
                                .tracking(0.7)
                                .padding(.horizontal, 12).padding(.vertical, 7)
                                .glassEffect(.regular.tint(Color.synAccent.opacity(0.17)), in: Capsule())
                        }
                        .padding(.horizontal, 3)
                        hero''',1)
a = a.replace('''                                .background(Color.synSurface.opacity(0.9), in: RoundedRectangle(cornerRadius: 23, style: .continuous))
                                .overlay(RoundedRectangle(cornerRadius: 23).strokeBorder(.white.opacity(0.075)))''',
'''                                .background(Color.black.opacity(0.21), in: RoundedRectangle(cornerRadius: 23, style: .continuous))
                                .glassEffect(.regular, in: RoundedRectangle(cornerRadius: 23, style: .continuous))
                                .overlay(RoundedRectangle(cornerRadius: 23).strokeBorder(.white.opacity(0.17), lineWidth: 0.8))''',1)
a = a.replace('''            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.large)''',
'''            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)''', 1)
a = a.replace('''                .scrollContentBackground(.hidden)
                .background(Color.synBackground)
                .tint(Color.synAccent)''',
'''                .scrollContentBackground(.hidden)
                .background(Color.black)
                .tint(Color.synAccent)''',1)
a = a.replace('''        .background(Color.synElevated.opacity(0.64), in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(.white.opacity(0.10)))''',
'''        .background(Color.black.opacity(0.19), in: RoundedRectangle(cornerRadius: 18))
        .glassEffect(.regular, in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(.white.opacity(0.21), lineWidth: 0.75))''',1)
a = a.replace('''                .background(Color.synAccent.opacity(page == .diagnostics ? 0.65 : 0.13), in: RoundedRectangle(cornerRadius: 13))''',
'''                .background(Color.synAccent.opacity(page == .diagnostics ? 0.24 : 0.12), in: RoundedRectangle(cornerRadius: 13))
                .overlay(RoundedRectangle(cornerRadius: 13).strokeBorder(.white.opacity(0.12)))''',1)
# All existing Form subpages retain their settings but use consistent dark grouped
# backgrounds rather than the old default gray table.
a = a.replace('''        Form {''','''        Form {''') # keep native controls accessible
a = a.replace('''        }.navigationTitle(''','''        }
        .scrollContentBackground(.hidden)
        .background(Color.black)
        .navigationTitle(''')
# Ensure the global streaming preferences describe the real current behavior.
a = a.replace('''Picker("Preferred source quality", selection: $quality)''',
              '''Picker("Preferred quality", selection: $quality)''')
a = a.replace('''Text("Quality is a preference, not a guarantee. Synscraper may return only one source or an adaptive HLS stream.").font(.footnote).foregroundStyle(.secondary)''',
'''Text("Change resolution while watching under Player Settings → Quality. Miami's available resolutions are grouped there; unsupported resolutions are never invented.")
                    .font(.footnote).foregroundStyle(.secondary)''')
settings.write_text(a)

x = project.read_text()
assert x.count('MARKETING_VERSION = "3.9.2";') == 2
project.write_text(x.replace('MARKETING_VERSION = "3.9.2";',
                             'MARKETING_VERSION = "3.9.3";'))
print("Civy 3.9.3: Miami quality grouping + flagship player and app Settings applied")
