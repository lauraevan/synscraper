from pathlib import Path
import sys

root = Path(sys.argv[1])
file = root / "Civy" / "PlayerScreen.swift"
s = file.read_text()
def rep(before, after, count=1):
    global s
    assert s.count(before) == count, (before[:130], s.count(before))
    s = s.replace(before, after, count)

rep("// MARK: - Native playback engine.", """// Only HLS renditions actually advertised by a server are selectable.
struct CivyQualityLevel: Identifiable, Equatable {
    let label: String
    let url: URL
    let bitrate: Int
    var id: String { label }
}

// MARK: - Native playback engine.""")
rep("    @Published var bufferedAhead: Double = 0\n",
"""    @Published var bufferedAhead: Double = 0
    @Published private(set) var qualityLevels: [CivyQualityLevel] = []
    @Published private(set) var selectedQuality: String = "Auto"
    private var qualityTask: Task<Void, Never>?
""")
rep("""    func selectSource(at index: Int, preserveTime: Bool = true) {
        guard sources.indices.contains(index), let api else { return }
""", """    func selectSource(at index: Int, preserveTime: Bool = true, quality: CivyQualityLevel? = nil) {
        guard sources.indices.contains(index), let api else { return }
        let sameSource = selectedIndex == index
        if !sameSource { qualityLevels = [] }
        selectedQuality = quality?.label ?? "Auto"
        qualityTask?.cancel()
""")
rep("""            let url = try api.playbackURL(sources[index])
            selectedIndex = index
""", """            let url: URL
            if let quality { url = quality.url }
            else { url = try api.playbackURL(sources[index]) }
            selectedIndex = index
            if quality == nil && (!sameSource || qualityLevels.isEmpty) {
                let kind = sources[index].type ?? ""
                let serverID = sources[index].id
                qualityTask = Task { [weak self] in
                    let variants = await Self.discoverHLSQuality(url: url, kind: kind)
                    guard !Task.isCancelled, let self, self.currentSource?.id == serverID else { return }
                    self.qualityLevels = variants
                }
            }
""")
rep("    func failCurrentSource(_ reason: String) {\n",
    (Path(__file__).with_name("quality_fragment.swiftpart").read_text() + "    func failCurrentSource(_ reason: String) {\n"))
rep("""    func stop() {
        player.pause()""", """    func stop() {
        qualityTask?.cancel()
        player.pause()""")
rep("""private enum PlayerPanel: String, Identifiable {
    case episodes, subtitles, speed, sources, statistics
    var id: String { rawValue }
}
""", """private enum PlayerPanel: String, Identifiable {
    case episodes, subtitles, speed, sources, statistics
    var id: String { rawValue }
}
private enum CivySettingsPage {
    case main, quality, sleep, subtitleStyle, screen, sources, cast
}
""")
rep("    @State private var triggerPiP = false\n",
"""    @State private var triggerPiP = false
    @State private var showPlayerSettings = false
    @State private var settingsPage: CivySettingsPage = .main
    @State private var sleepMinutes = 0
    @State private var sleepTask: Task<Void, Never>?
    @State private var castNames = ""
    @State private var castLoading = false
    @State private var subtitleStyle = "Standard"
""")
rep("                if controlsVisible && !controlsLocked {\n",
    "                if controlsVisible && !controlsLocked && !showPlayerSettings {\n")
rep("""                if playback.isResolving || (playback.isBuffering && !playback.isPlaying && !isWebPlayback && playback.error == nil) {
                    ProgressView()
                        .tint(.white)
                        .scaleEffect(1.35)
                        .allowsHitTesting(false)
                }
""", """                if !isWebPlayback && playback.error == nil &&
                   (playback.isResolving || (playback.isBuffering && !playback.isPlaying)) {
                    CivyCinematicLoading(message: playback.isResolving ? "Finding a stream…" :
                        "Connecting to Server \(playback.selectedIndex.map { $0 + 1 } ?? 1)…")
                        .allowsHitTesting(false)
                        .zIndex(5)
                }
                if showPlayerSettings {
                    playerSettingsOverlay(isWide: geo.size.width > geo.size.height)
                        .transition(.opacity)
                        .zIndex(20)
                }
""")
rep("""            hideTask?.cancel()
            playback.stop()
""", """            hideTask?.cancel()
            sleepTask?.cancel()
            playback.stop()
""")
rep("""                    playerIcon("gearshape", "Player settings") { panel = .sources }
                    Button { closePlayer() } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 22, weight: .medium))
                            .frame(width: 38, height: 40)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain).accessibilityLabel("Close player")
""", """                    playerIcon("gearshape", "Player settings") { openSettings() }
                    playerIcon("xmark", "Close player") { closePlayer() }
""")
rep("""    private func playerIcon(_ symbol: String, _ label: String, isSelected: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 20, weight: .regular))
                .foregroundStyle(isSelected ? Color.synAccent : .white)
                .frame(width: 39, height: 39)
                .background(.black.opacity(0.36), in: Circle())
                .overlay(Circle().strokeBorder(.white.opacity(0.17), lineWidth: 0.7))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
""", """    private func playerIcon(_ symbol: String, _ label: String, isSelected: Bool = false, action: @escaping () -> Void) -> some View {
        Button {
            if haptics { UIImpactFeedbackGenerator(style: .soft).impactOccurred() }
            action()
        } label: {
            Image(systemName: symbol)
                .font(.system(size: 19, weight: .medium))
                .foregroundStyle(isSelected ? Color.synAccent : .white)
                .frame(width: 44, height: 44)
                .glassEffect(.regular.interactive(), in: Circle())
                .overlay(Circle().strokeBorder(.white.opacity(0.22), lineWidth: 0.8))
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
""")
rep("""            .foregroundStyle(.white)
            .padding(.horizontal, glassButtons ? 12 : 0)
            .padding(.vertical, glassButtons ? 9 : 0)
            .civyGlassCapsule(glassButtons)
            .contentShape(Rectangle())
""", """            .foregroundStyle(.white)
            .padding(.horizontal, glassButtons ? 12 : 0)
            .padding(.vertical, glassButtons ? 9 : 0)
            .glassEffect(glassButtons ? .regular.interactive() : .identity, in: Capsule())
            .overlay(Capsule().strokeBorder(.white.opacity(glassButtons ? 0.18 : 0), lineWidth: 0.65))
            .contentShape(Capsule())
""")
rep("""optionRow(source.name, detail: "\(source.quality ?? "Auto") · \(source.provider ?? "Stream")",""",
    """optionRow("Server \(index + 1)", detail: "\(source.quality ?? "Auto") · \(source.name)",""")
rep("    private func playerIcon(",
    Path(__file__).with_name("settings_fragment.swiftpart").read_text() + "    private func playerIcon(")
s += Path(__file__).with_name("loading_fragment.swiftpart").read_text()
file.write_text(s)
project = root / "Civy.xcodeproj" / "project.pbxproj"
old = project.read_text()
assert old.count('MARKETING_VERSION = "3.9.1";') == 2
project.write_text(old.replace('MARKETING_VERSION = "3.9.1";', 'MARKETING_VERSION = "3.9.2";'))
assert 'CivyCinematicLoading' in s and 'CivyQualityLevel' in s
print("Civy 3.9.2 cinematic player, quality, glass, servers and settings installed")
