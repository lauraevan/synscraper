import SwiftUI
import WebKit
import UIKit

struct NativePlayerView: View {
    let request: PlayerRequest

    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var theme: ThemeStore
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var reloadID = UUID()

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                Color.black.ignoresSafeArea()

                SynPlayerWebView(
                    request: request,
                    reloadID: reloadID,
                    isLoading: $isLoading,
                    errorMessage: $errorMessage,
                    onClose: closePlayer
                )
                .ignoresSafeArea()

                if isLoading && errorMessage == nil {
                    loadingOverlay
                        .allowsHitTesting(false)
                }

                if let errorMessage {
                    errorOverlay(errorMessage)
                        .padding(.horizontal, 24)
                        .zIndex(20)
                }

                VStack(spacing: 0) {
                    HStack {
                        Button(action: closePlayer) {
                            Image(systemName: "xmark")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundStyle(.white)
                                .frame(width: 42, height: 42)
                        }
                        .buttonStyle(.plain)
                        .synflixCircleGlass(tint: .black.opacity(0.18), interactive: true)
                        .accessibilityLabel("Close player")

                        Spacer()

                        if isLoading {
                            ProgressView()
                                .controlSize(.small)
                                .tint(theme.accent)
                                .frame(width: 42, height: 42)
                                .synflixCircleGlass(tint: .black.opacity(0.12), interactive: false)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, geometry.safeAreaInsets.top + 8)

                    Spacer()
                }
                .zIndex(50)
            }
        }
        .preferredColorScheme(.dark)
        .statusBarHidden(true)
        .persistentSystemOverlays(.hidden)
    }

    private var loadingOverlay: some View {
        ZStack {
            Color.black

            VStack(spacing: 16) {
                SynFlixBrandMark(size: 72)
                ProgressView()
                    .controlSize(.regular)
                    .tint(theme.accent)
                Text(request.title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.78))
                    .lineLimit(1)
                    .padding(.horizontal, 30)
            }
        }
        .ignoresSafeArea()
    }

    private func errorOverlay(_ message: String) -> some View {
        VStack(spacing: 18) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 28, weight: .semibold))
                .foregroundStyle(theme.accent)

            VStack(spacing: 7) {
                Text("Player couldn’t load")
                    .font(.system(size: 20, weight: .bold))
                Text(message)
                    .font(.system(size: 13))
                    .foregroundStyle(.white.opacity(0.52))
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 360)
            }

            HStack(spacing: 10) {
                GlassActionButton(title: "Close", symbol: "xmark") {
                    closePlayer()
                }

                GlassActionButton(title: "Retry", symbol: "arrow.clockwise", tint: theme.accent.opacity(0.12)) {
                    errorMessage = nil
                    isLoading = true
                    reloadID = UUID()
                }
            }
        }
        .padding(.horizontal, 28)
        .padding(.vertical, 26)
        .synflixGlass(tint: .black.opacity(0.18), cornerRadius: 24)
    }

    private func closePlayer() {
        theme.impact(.light)
        dismiss()
    }
}

private struct SynPlayerWebView: UIViewRepresentable {
    let request: PlayerRequest
    let reloadID: UUID
    @Binding var isLoading: Bool
    @Binding var errorMessage: String?
    let onClose: () -> Void

    private let allowedHost = "synscraper-tffk.vercel.app"

    func makeCoordinator() -> Coordinator {
        Coordinator(isLoading: $isLoading, errorMessage: $errorMessage, onClose: onClose)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        configuration.allowsPictureInPictureMediaPlayback = true
        configuration.allowsAirPlayForMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.defaultWebpagePreferences.preferredContentMode = .mobile

        configuration.userContentController.add(context.coordinator, name: "synflixPlayerBridge")

        let bridge = WKUserScript(
            source: """
            (() => {
              window.__SYNFLIX_IOS_PLAYER__ = true;
              document.documentElement.dataset.synflixIosPlayer = 'true';

              const sendClose = () => {
                try {
                  window.webkit.messageHandlers.synflixPlayerBridge.postMessage({ type: 'close' });
                } catch (_) {}
              };

              window.addEventListener('message', (event) => {
                const data = event && event.data;
                if (data && data.type === 'synplayer:back') sendClose();
              });

              window.addEventListener('synflix:native-close-player', sendClose);
            })();
            """,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        configuration.userContentController.addUserScript(bridge)

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = .black
        webView.underPageBackgroundColor = .black
        webView.scrollView.backgroundColor = .black
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsBackForwardNavigationGestures = false
        webView.allowsLinkPreview = false
        webView.customUserAgent = "SynFlix-iOS/1.6 Player Mobile Safari WebKit"

        context.coordinator.webView = webView
        loadPlayer(in: webView)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.onClose = onClose
        if context.coordinator.reloadID != reloadID {
            context.coordinator.reloadID = reloadID
            loadPlayer(in: webView)
        }
    }

    private func loadPlayer(in webView: WKWebView) {
        guard let url = playerURL else {
            DispatchQueue.main.async {
                isLoading = false
                errorMessage = "SynFlix couldn’t create the player URL."
            }
            return
        }

        let request = URLRequest(
            url: url,
            cachePolicy: .reloadRevalidatingCacheData,
            timeoutInterval: 25
        )
        webView.load(request)
    }

    private var playerURL: URL? {
        var components = URLComponents()
        components.scheme = "https"
        components.host = allowedHost
        components.path = "/embed/\(request.media.kind)/\(request.media.id)"

        var items = [
            URLQueryItem(name: "system", value: "1"),
            URLQueryItem(name: "iosPlayer", value: "1")
        ]

        if let season = request.season {
            items.append(URLQueryItem(name: "season", value: String(season)))
        }
        if let episode = request.episode {
            items.append(URLQueryItem(name: "episode", value: String(episode)))
        }

        components.queryItems = items
        return components.url
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        @Binding var isLoading: Bool
        @Binding var errorMessage: String?
        var onClose: () -> Void
        var reloadID = UUID()
        weak var webView: WKWebView?

        private let allowedHost = "synscraper-tffk.vercel.app"

        init(
            isLoading: Binding<Bool>,
            errorMessage: Binding<String?>,
            onClose: @escaping () -> Void
        ) {
            _isLoading = isLoading
            _errorMessage = errorMessage
            self.onClose = onClose
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "synflixPlayerBridge",
                  let body = message.body as? [String: Any],
                  body["type"] as? String == "close" else {
                return
            }
            DispatchQueue.main.async { self.onClose() }
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            isLoading = true
            errorMessage = nil
        }

        func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
            errorMessage = nil
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            isLoading = false
            errorMessage = nil
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            handleFailure(error)
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            handleFailure(error)
        }

        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            webView.reload()
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }

            if url.host == allowedHost || url.scheme == "about" {
                decisionHandler(.allow)
                return
            }

            if navigationAction.navigationType == .linkActivated {
                UIApplication.shared.open(url)
            }
            decisionHandler(.cancel)
        }

        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            guard let url = navigationAction.request.url else { return nil }
            if url.host == allowedHost {
                webView.load(URLRequest(url: url))
            } else {
                UIApplication.shared.open(url)
            }
            return nil
        }

        private func handleFailure(_ error: Error) {
            let nsError = error as NSError
            if nsError.code == NSURLErrorCancelled { return }
            isLoading = false
            errorMessage = "The new SynPlayer couldn’t connect. Check your connection and try again."
        }
    }
}
