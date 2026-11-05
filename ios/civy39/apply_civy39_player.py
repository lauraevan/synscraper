from pathlib import Path
import sys
root=Path(sys.argv[1]); file=root/'Civy/PlayerScreen.swift'
s=file.read_text()
s=s.replace('import AVFoundation\n','import AVFoundation\nimport AVKit\n',1)
s=s.replace('''    @State private var hideTask: Task<Void, Never>?
''','''    @State private var hideTask: Task<Void, Never>?
    @State private var brightness: Double = Double(UIScreen.main.brightness)
    @State private var rating = 0
    @State private var episodeTitle = ""
    @State private var showReport = false
    @State private var reportSaved = false
    @State private var controlsLocked = false
    @State private var triggerPiP = false
''',1)
s=s.replace('''VideoSurface(player: playback.player, fill: aspectFill)''','''VideoSurface(player: playback.player, fill: aspectFill, triggerPiP: $triggerPiP)''',1)
s=s.replace('''if tapControls { toggleControls() }''','''if tapControls && !controlsLocked { toggleControls() }''',1)
s=s.replace('''                if controlsVisible {
                    playerChrome''','''                if controlsLocked {
                    Button {
                        controlsLocked = false
                        showControls()
                    } label: {
                        Image(systemName: "lock.open")
                            .font(.system(size: 20, weight: .semibold))
                            .foregroundStyle(.white)
                            .frame(width: 50, height: 50)
                            .glassEffect(.regular.interactive(), in: Circle())
                    }
                    .accessibilityLabel("Unlock playback controls")
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                    .padding(.trailing, 35).padding(.top, 18)
                }
                if controlsVisible && !controlsLocked {
                    playerChrome''',1)
s=s.replace('''        .sheet(item: $panel, onDismiss: scheduleHide)''','''        .confirmationDialog("Report a playback issue", isPresented: $showReport) {
            Button("Stream not loading") { saveLocalReport("Stream not loading") }
            Button("Wrong episode or title") { saveLocalReport("Wrong episode or title") }
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("Feedback is saved on this iPhone, not sent to a server.")
        }
        .alert("Report saved on device", isPresented: $reportSaved) {
            Button("OK", role: .cancel) { }
        }
        .sheet(item: $panel, onDismiss: scheduleHide)''',1)
s=s.replace('''            await load()
            scheduleHide()
''','''            await load()
            rating = UserDefaults.standard.integer(forKey: "civy.rating.\(app.activeProfileID ?? "primary").\(request.media.key)")
            if request.media.kind == "tv", let season = request.season {
                let episodes = try? await app.api.season(for: request.media, number: season)
                episodeTitle = episodes?.first(where: { $0.episodeNumber == (request.episode ?? 1) })?.name ?? ""
            }
            scheduleHide()
''',1)
# update player chrome with redesigned component
start=s.index('    private func playerChrome(isWide: Bool, bounds: CGSize) -> some View {')
end=s.index('    private var statsOverlay: some View {',start)
chrome=(Path(__file__).parent/'Civy39PlayerChrome.swiftfrag').read_text()
s=s[:start]+chrome+'\n    private func saveLocalReport(_ reason: String) {\n        UserDefaults.standard.set("\\(reason) · \\(Date().formatted())", forKey: "civy.localReport.\\(request.media.key)")\n        reportSaved = true\n    }\n\n'+s[end:]
# Add functional PiP route available in player chrome before settings, never a dead icon.
s=s.replace('''                    playerIcon("gearshape", "Player settings")''','''                    if isWide {
                        playerIcon("pip.enter", "Picture in Picture") { triggerPiP = true }
                    }
                    playerIcon("gearshape", "Player settings")''',1)
# VideoSurface full player layer and PiP. Keep native layer only; no fake controls.
start=s.index('final class VideoPlayerUIView: UIView {')
end=s.index('struct SynWebPlayer: UIViewRepresentable {',start)
replacement='''final class VideoPlayerUIView: UIView {
    override static var layerClass: AnyClass { AVPlayerLayer.self }
    var videoLayer: AVPlayerLayer { layer as! AVPlayerLayer }
    var pipController: AVPictureInPictureController?
}

struct VideoSurface: UIViewRepresentable {
    let player: AVPlayer
    let fill: Bool
    @Binding var triggerPiP: Bool
    func makeUIView(context: Context) -> VideoPlayerUIView {
        let view = VideoPlayerUIView()
        view.backgroundColor = .black
        view.videoLayer.player = player
        view.videoLayer.videoGravity = fill ? .resizeAspectFill : .resizeAspect
        if AVPictureInPictureController.isPictureInPictureSupported() {
            view.pipController = AVPictureInPictureController(playerLayer: view.videoLayer)
            view.pipController?.canStartPictureInPictureAutomaticallyFromInline = true
        }
        return view
    }
    func updateUIView(_ view: VideoPlayerUIView, context: Context) {
        if view.videoLayer.player !== player { view.videoLayer.player = player }
        view.videoLayer.videoGravity = fill ? .resizeAspectFill : .resizeAspect
        if triggerPiP {
            if view.pipController?.isPictureInPicturePossible == true {
                view.pipController?.startPictureInPicture()
            }
            DispatchQueue.main.async { triggerPiP = false }
        }
    }
}

'''
s=s[:start]+replacement+s[end:]
file.write_text(s)
print('Civy 3.9 player refreshed')
