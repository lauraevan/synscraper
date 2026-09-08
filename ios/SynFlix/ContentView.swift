import SwiftUI
import WebKit

struct ContentView: View {
    @State private var isLoading = true

    var body: some View {
        ZStack {
            Color(red: 0.03, green: 0.03, blue: 0.05)
                .ignoresSafeArea()

            SynFlixWebView(isLoading: $isLoading)
                .ignoresSafeArea()

            if isLoading {
                ProgressView()
                    .controlSize(.large)
                    .tint(.white)
                    .padding(22)
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
        }
        .preferredColorScheme(.dark)
    }
}

struct SynFlixWebView: UIViewRepresentable {
    @Binding var isLoading: Bool

    private let homeURL = URL(string: "https://synscraper-tffk.vercel.app/?iosApp=1")!

    func makeCoordinator() -> Coordinator {
        Coordinator(isLoading: $isLoading)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.allowsPictureInPictureMediaPlayback = true
        configuration.allowsAirPlayForMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true

        let appBridge = WKUserScript(
            source: "window.__SYNFLIX_IOS__=true;document.documentElement.classList.add('synflix-ios-app');",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        configuration.userContentController.addUserScript(appBridge)

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = UIColor(red: 0.03, green: 0.03, blue: 0.05, alpha: 1)
        webView.scrollView.keyboardDismissMode = .interactive
        webView.customUserAgent = "SynFlix-iOS/1.0 Mobile Safari WebKit"

        let refresh = UIRefreshControl()
        refresh.tintColor = .white
        refresh.addTarget(context.coordinator, action: #selector(Coordinator.refresh(_:)), for: .valueChanged)
        webView.scrollView.refreshControl = refresh

        context.coordinator.webView = webView
        isLoading = true
        webView.load(URLRequest(url: homeURL, cachePolicy: .reloadRevalidatingCacheData, timeoutInterval: 30))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        @Binding private var isLoading: Bool
        weak var webView: WKWebView?

        init(isLoading: Binding<Bool>) {
            _isLoading = isLoading
        }

        @objc func refresh(_ sender: UIRefreshControl) {
            webView?.reload()
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            isLoading = true
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            webView.scrollView.refreshControl?.endRefreshing()
            isLoading = false
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            webView.scrollView.refreshControl?.endRefreshing()
            isLoading = false
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            webView.scrollView.refreshControl?.endRefreshing()
            isLoading = false
        }

        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            if navigationAction.targetFrame == nil, let requestURL = navigationAction.request.url {
                webView.load(URLRequest(url: requestURL))
            }
            return nil
        }
    }
}
