import SwiftUI
import AVKit
import AVFoundation

@MainActor
final class NativePlayerModel: ObservableObject {
    enum Phase: Equatable {
        case loading
        case ready
        case failed(String)
    }

    let request: PlayerRequest
    @Published var phase: Phase = .loading
    @Published var player: AVPlayer?
    @Published var servers: [StreamServer] = []
    @Published var selectedServerID: String?

    init(request: PlayerRequest) {
        self.request = request
    }

    var selectedServer: StreamServer? {
        servers.first(where: { $0.id == selectedServerID })
    }

    func load(autoplay: Bool) async {
        phase = .loading
        do {
            let loaded = try await SynFlixAPI.shared.streams(for: request)
            servers = loaded
            guard let first = loaded.first(where: { $0.primary == true }) ?? loaded.first else {
                throw SynFlixAPI.APIError.noStreams
            }
            await select(first, autoplay: autoplay)
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }

    func select(_ server: StreamServer, autoplay: Bool = true) async {
        guard let url = await SynFlixAPI.shared.playableURL(for: server) else {
            phase = .failed("That source returned an invalid playback URL.")
            return
        }

        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback, options: [.allowAirPlay])
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            // Playback can still work even if another app temporarily owns the audio session.
        }

        let item = AVPlayerItem(url: url)
        item.preferredForwardBufferDuration = 8
        let nextPlayer = AVPlayer(playerItem: item)
        nextPlayer.automaticallyWaitsToMinimizeStalling = true
        player?.pause()
        player = nextPlayer
        selectedServerID = server.id
        phase = .ready
        if autoplay { nextPlayer.play() }
    }

    func stop() {
        player?.pause()
        player = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
    }
}

struct NativePlayerView: View {
    let request: PlayerRequest
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var theme: ThemeStore
    @StateObject private var model: NativePlayerModel

    init(request: PlayerRequest) {
        self.request = request
        _model = StateObject(wrappedValue: NativePlayerModel(request: request))
    }

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                Color.black.ignoresSafeArea()

                if let player = model.player {
                    PlayerController(player: player)
                        .ignoresSafeArea()
                }

                switch model.phase {
                case .loading:
                    VStack(spacing: 17) {
                        SynFlixBrandMark(size: 70)
                        ProgressView()
                            .controlSize(.regular)
                            .tint(theme.accent)
                        VStack(spacing: 3) {
                            Text(request.title)
                                .font(.system(size: 16, weight: .bold))
                                .lineLimit(1)
                            Text("Finding the best source")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(.white.opacity(0.42))
                        }
                    }
                case .failed(let message):
                    VStack(spacing: 18) {
                        SynFlixBrandMark(size: 62)
                        VStack(spacing: 7) {
                            Text("Playback unavailable")
                                .font(.system(size: 21, weight: .bold))
                            Text(message)
                                .font(.system(size: 13))
                                .foregroundStyle(.white.opacity(0.48))
                                .multilineTextAlignment(.center)
                                .frame(maxWidth: 340)
                        }
                        HStack(spacing: 10) {
                            GlassActionButton(title: "Close", symbol: "xmark") { dismiss() }
                            GlassActionButton(title: "Retry", symbol: "arrow.clockwise", tint: theme.accent.opacity(0.12)) {
                                Task { await model.load(autoplay: theme.autoplayEnabled) }
                            }
                        }
                    }
                    .padding(26)
                case .ready:
                    EmptyView()
                }

                VStack {
                    HStack(spacing: 10) {
                        GlassIconButton(symbol: "chevron.down", label: "Close player", tint: .black.opacity(0.16)) {
                            theme.impact()
                            dismiss()
                        }

                        Spacer()

                        if !model.servers.isEmpty {
                            Menu {
                                ForEach(model.servers) { server in
                                    Button {
                                        theme.impact()
                                        Task { await model.select(server, autoplay: true) }
                                    } label: {
                                        HStack {
                                            Text(server.name)
                                            if model.selectedServerID == server.id {
                                                Image(systemName: "checkmark")
                                            }
                                        }
                                    }
                                }
                            } label: {
                                HStack(spacing: 7) {
                                    Circle()
                                        .fill(theme.accent)
                                        .frame(width: 6, height: 6)
                                    Text(model.selectedServer?.quality ?? model.selectedServer?.name ?? "Source")
                                        .font(.system(size: 11.5, weight: .bold))
                                        .lineLimit(1)
                                    Image(systemName: "chevron.up.chevron.down")
                                        .font(.system(size: 8.5, weight: .black))
                                }
                                .foregroundStyle(.white.opacity(0.90))
                                .padding(.horizontal, 13)
                                .frame(height: 40)
                            }
                            .synflixGlass(tint: theme.accent.opacity(0.055), cornerRadius: 20, interactive: true)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, geometry.safeAreaInsets.top + 8)

                    Spacer()
                }
            }
        }
        .preferredColorScheme(.dark)
        .statusBarHidden(true)
        .task { await model.load(autoplay: theme.autoplayEnabled) }
        .onDisappear { model.stop() }
    }
}

struct PlayerController: UIViewControllerRepresentable {
    let player: AVPlayer

    func makeUIViewController(context: Context) -> AVPlayerViewController {
        let controller = AVPlayerViewController()
        controller.player = player
        controller.videoGravity = .resizeAspect
        controller.showsPlaybackControls = true
        controller.allowsPictureInPicturePlayback = true
        controller.canStartPictureInPictureAutomaticallyFromInline = true
        controller.exitsFullScreenWhenPlaybackEnds = false
        return controller
    }

    func updateUIViewController(_ controller: AVPlayerViewController, context: Context) {
        if controller.player !== player {
            controller.player = player
        }
    }
}
