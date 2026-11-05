"""Civy 3.9.4: simple playback quality + flagship My Civy library."""
from pathlib import Path
import sys

root = Path(sys.argv[1])
player = root / "Civy/PlayerScreen.swift"
settings = root / "Civy/SettingsView.swift"
home = root / "Civy/RootView.swift"
project = root / "Civy.xcodeproj/project.pbxproj"
profile = root / "Civy/CivyMyCivy.swift"
assert profile.exists()

# Keep technical provider details in the source selector and out of Quality.
p = player.read_text()
def swap(old, new, expected=1):
    global p
    count = p.count(old)
    assert count == expected, ("player UI anchor", count, old[:100])
    p = p.replace(old, new, expected)

swap('''                Text(playback.currentSource?.name ?? "Current server")
                    .font(.system(size: 15, weight: .medium))
                Text("Change the resolution right here. Your server stays selected and playback resumes where you left off.")''',
'''                Text("Choose your picture quality")
                    .font(.system(size: 16, weight: .semibold))
                Text("Auto is recommended. Select a resolution when this video offers more than one.")''')
swap('''settingChoice("Automatic", subtitle: "Use adaptive playback or the best available stream",''',
     '''settingChoice("Auto", subtitle: "Best available picture, adjusted automatically",''')
swap('''subtitle: "Available on \\(playback.currentSource?.name ?? "this server")",''',
     '''subtitle: nil,''')
swap('''Label("This stream provides no switchable resolutions. The server controls its output quality.",''',
     '''Label("This video adjusts its picture quality automatically.",''')
swap('''Text("Choose a provider. Resolutions for the selected provider, including Miami, appear under Quality.")''',
     '''Text("If playback isn't working, try another source. Picture quality is adjusted separately.")''')
swap('''settingRow("Server", icon: "server.rack", value: "Server \\(playback.selectedServerNumber)")''',
     '''settingRow("Playback source", icon: "rectangle.on.rectangle", value: nil)''')
swap('''case .sources: "Playback servers"''', '''case .sources: "Playback source"''')
# Remove provider-related labels from the quality heading.
swap('''Text("PICTURE QUALITY")''', '''Text("PLAYBACK")''')
# No provider mention in the quality screen, even for one resolution.
start = p.index('        case .quality:\n            VStack(')
end = p.index('        case .sleep:', start)
fragment = p[start:end]
assert not any(word in fragment.lower() for word in ["miami","provider","server","source"]), fragment
player.write_text(p)

a = settings.read_text()
updates = [
    ('case .streaming: "Streaming & quality"', 'case .streaming: "Video quality"'),
    ('case .streaming: "Quality, buffer and server fallback"', 'case .streaming: "Picture clarity and smooth playback"'),
    ('Picker("Preferred quality", selection: $quality)', 'Picker("Preferred quality", selection: $quality)'),
    ('Section("Sources") {\n                Picker("Preferred quality"', 'Section("Picture quality") {\n                Picker("Preferred quality"'),
    ('Toggle("Try next source on failure", isOn: $failover)', 'Toggle("Keep playing if a stream fails", isOn: $failover)'),
    ("Text(\"Change resolution while watching under Player Settings → Quality. Miami's available resolutions are grouped there; unsupported resolutions are never invented.\")",
     'Text("Auto is recommended. You can change picture quality while watching. Only supported resolutions are shown.")'),
    ('Section("Buffering") {', 'Section("Playback performance") {'),
    ('.navigationTitle("Streaming")', '.navigationTitle("Video quality")')
]
for old, new in updates:
    if old == new: continue
    assert old in a, ("Settings anchor missing", old[:100])
    a = a.replace(old, new, 1)
settings.write_text(a)

# Replace the generic profile menu with a real cinematic personal library.
s = home.read_text()
start = s.index('private struct CivyProfileView: View {')
end = s.index('struct CivyNewAndHotView: View {', start)
s = s[:start] + '''private struct CivyProfileView: View {
    var body: some View { CivyMyCivyView() }
}

''' + s[end:]
# Make the dock display the active viewer rather than a fixed blue smile icon.
old = '''    @AppStorage("civy.appearance.haptics") private var haptics = true
    @Namespace private var selectionGlass'''
new = '''    @AppStorage("civy.appearance.haptics") private var haptics = true
    @EnvironmentObject private var viewers: CivyViewerStore
    @Namespace private var selectionGlass'''
assert s.count(old) == 1
s = s.replace(old, new, 1)
old = '''                                    Image(systemName: "face.smiling")
                                        .font(.system(size: 20, weight: .medium))
                                        .foregroundStyle(.white)
                                        .frame(width: 29, height: 27)
                                        .background(Color(red: 0.18, green: 0.47, blue: 0.86), in: RoundedRectangle(cornerRadius: 7))'''
new = '''                                    CivyViewerAvatar(
                                        viewer: viewers.active ?? CivyViewer(
                                            id: "primary", name: "You",
                                            symbol: "person.fill", tintIndex: 0),
                                        size: 29
                                    )
                                    .frame(width: 29, height: 27)'''
assert s.count(old) == 1
s = s.replace(old, new, 1)
home.write_text(s)

x = project.read_text()
reference = "A394A394A394A394A394A394"
build = "B394B394B394B394B394B394"
assert reference not in x and build not in x
marker = '\t\t9F6CFF8906F1A9A5F87CD18B /* PBXFileReference */ = {'
assert x.count(marker) == 1
x = x.replace(marker, f'''\t\t{reference} /* PBXFileReference */ = {{ isa = PBXFileReference; lastKnownFileType = "sourcecode.swift"; path = "CivyMyCivy.swift"; sourceTree = "<group>"; }};
\t\t{build} /* PBXBuildFile */ = {{ isa = PBXBuildFile; fileRef = "{reference}"; }};
''' + marker, 1)
old = 'C1F0C1F0C1F0C1F0C1F0C1F1, 4DB5DC12B30043BAA94F7C00'
assert x.count(old) == 1
x = x.replace(old, 'C1F0C1F0C1F0C1F0C1F0C1F1, ' + reference + ', 4DB5DC12B30043BAA94F7C00', 1)
old = 'C1F0C1F0C1F0C1F0C1F0C1F2, 5B387801BB68F29512AE4894'
assert x.count(old) == 1
x = x.replace(old, 'C1F0C1F0C1F0C1F0C1F0C1F2, ' + build + ', 5B387801BB68F29512AE4894', 1)
assert x.count('MARKETING_VERSION = "3.9.3";') == 2
x = x.replace('MARKETING_VERSION = "3.9.3";', 'MARKETING_VERSION = "3.9.4";')
assert x.count('CURRENT_PROJECT_VERSION = "10";') == 2
x = x.replace('CURRENT_PROJECT_VERSION = "10";', 'CURRENT_PROJECT_VERSION = "11";')
project.write_text(x)
print("Civy 3.9.4: simple video quality, active profile dock and My Civy redesign applied")
