import SwiftUI
import WebKit
import UIKit
import Combine

private enum AppSection: String, CaseIterable, Identifiable {
    case home
    case search
    case library
    case settings

    var id: String { rawValue }

    var title: String {
        switch self {
        case .home: return "Home"
        case .search: return "Search"
        case .library: return "My List"
        case .settings: return "Settings"
        }
    }

    var symbol: String {
        switch self {
        case .home: return "house.fill"
        case .search: return "magnifyingglass"
        case .library: return "bookmark.fill"
        case .settings: return "slider.horizontal.3"
        }
    }

    var url: URL {
        switch self {
        case .home:
            return URL(string: "https://synscraper-tffk.vercel.app/?iosApp=1")!
        case .search:
            return URL(string: "https://synscraper-tffk.vercel.app/search?iosApp=1")!
        case .library:
            return URL(string: "https://synscraper-tffk.vercel.app/my-list?iosApp=1")!
        case .settings:
            return URL(string: "https://synscraper-tffk.vercel.app/settings?iosApp=1")!
        }
    }
}

final class SynFlixBrowserModel: ObservableObject {
    @Published var isLoading = true
    @Published var isInitialLoad = true
    @Published var canGoBack = false
    @Published var canGoForward = false
    @Published var pageTitle = "SynFlix"
    @Published var errorMessage: String?

    weak var webView: WKWebView?
    private(set) var initialURL = AppSection.home.url

    func navigate(to section: AppSection) {
        load(section.url)
    }

    func load(_ url: URL) {
        errorMessage = nil
        isLoading = true
        let request = URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData, timeoutInterval: 30)
        if let webView {
            webView.load(request)
        } else {
            initialURL = url
        }
    }

    func reload() {
        errorMessage = nil
        isLoading = true
        if let webView {
            webView.reload()
        } else {
            load(initialURL)
        }
    }

    func goBack() {
        webView?.goBack()
    }

    func goForward() {
        webView?.goForward()
    }

    func sync(from webView: WKWebView) {
        canGoBack = webView.canGoBack
        canGoForward = webView.canGoForward
        pageTitle = webView.title?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false ? (webView.title ?? "SynFlix") : "SynFlix"
    }
}

struct ContentView: View {
    @StateObject private var browser = SynFlixBrowserModel()
    @State private var selectedSection: AppSection = .home

    var body: some View {
        ZStack {
            appBackground

            VStack(spacing: 10) {
                topBar
                    .padding(.horizontal, 12)
                    .padding(.top, 6)

                ZStack(alignment: .top) {
                    SynFlixWebView(model: browser)
                        .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: 26, style: .continuous)
                                .strokeBorder(.white.opacity(0.09), lineWidth: 0.8)
                        }
                        .shadow(color: .black.opacity(0.28), radius: 22, y: 10)

                    if browser.isLoading && !browser.isInitialLoad {
                        GeometryReader { proxy in
                            Rectangle()
                                .fill(
                                    LinearGradient(
                                        colors: [Color.white.opacity(0.85), Color(red: 0.54, green: 0.45, blue: 1.0)],
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                )
                                .frame(width: max(48, proxy.size.width * 0.28), height: 2)
                                .clipShape(Capsule())
                                .shadow(color: Color(red: 0.52, green: 0.42, blue: 1).opacity(0.8), radius: 7)
                        }
                        .frame(height: 2)
                        .padding(.horizontal, 26)
                        .padding(.top, 1)
                    }

                    if let message = browser.errorMessage {
                        errorCard(message)
                            .padding(22)
                            .frame(maxWidth: 430)
                    }
                }
                .padding(.horizontal, 8)
                .padding(.bottom, 2)
            }
            .safeAreaInset(edge: .bottom, spacing: 0) {
                bottomDock
                    .padding(.horizontal, 14)
                    .padding(.top, 8)
                    .padding(.bottom, 8)
            }

            if browser.isInitialLoad {
                launchOverlay
                    .transition(.opacity.combined(with: .scale(scale: 1.02)))
                    .zIndex(20)
            }
        }
        .preferredColorScheme(.dark)
        .tint(Color(red: 0.66, green: 0.60, blue: 1.0))
    }

    private var appBackground: some View {
        ZStack {
            Color(red: 0.025, green: 0.03, blue: 0.055)
            RadialGradient(
                colors: [Color(red: 0.34, green: 0.18, blue: 0.72).opacity(0.28), .clear],
                center: .topTrailing,
                startRadius: 10,
                endRadius: 520
            )
            RadialGradient(
                colors: [Color(red: 0.10, green: 0.34, blue: 0.72).opacity(0.22), .clear],
                center: .bottomLeading,
                startRadius: 18,
                endRadius: 560
            )
        }
        .ignoresSafeArea()
    }

    private var topBar: some View {
        HStack(spacing: 10) {
            HStack(spacing: 9) {
                SynFlixMark(size: 34)
                VStack(alignment: .leading, spacing: 1) {
                    Text("SynFlix")
                        .font(.system(size: 16, weight: .semibold, design: .rounded))
                        .foregroundStyle(.white)
                    Text(browser.pageTitle == "SynFlix" ? "Streaming" : browser.pageTitle)
                        .font(.system(size: 10.5, weight: .medium))
                        .foregroundStyle(.white.opacity(0.42))
                        .lineLimit(1)
                }
            }

            Spacer(minLength: 6)

            Button {
                selectedSection = .search
                browser.navigate(to: .search)
            } label: {
                HStack(spacing: 7) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 13, weight: .semibold))
                    Text("Search")
                        .font(.system(size: 13, weight: .semibold, design: .rounded))
                }
                .foregroundStyle(.white.opacity(0.78))
                .padding(.horizontal, 13)
                .frame(height: 38)
            }
            .buttonStyle(.plain)
            .background(.ultraThinMaterial, in: Capsule())
            .overlay(Capsule().stroke(.white.opacity(0.13), lineWidth: 0.7))

            if browser.canGoBack {
                glassIconButton("chevron.left") { browser.goBack() }
            }

            glassIconButton("arrow.clockwise") { browser.reload() }
        }
        .padding(.horizontal, 11)
        .frame(height: 58)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(
                    LinearGradient(
                        colors: [.white.opacity(0.24), .white.opacity(0.06)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 0.8
                )
        }
        .shadow(color: .black.opacity(0.22), radius: 18, y: 8)
    }

    private func glassIconButton(_ symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(.white.opacity(0.82))
                .frame(width: 38, height: 38)
        }
        .buttonStyle(.plain)
        .background(.thinMaterial, in: Circle())
        .overlay(Circle().stroke(.white.opacity(0.12), lineWidth: 0.7))
    }

    private var bottomDock: some View {
        HStack(spacing: 4) {
            ForEach(AppSection.allCases) { section in
                Button {
                    selectedSection = section
                    browser.navigate(to: section)
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: section.symbol)
                            .font(.system(size: 17, weight: .semibold))
                            .symbolRenderingMode(.hierarchical)
                        Text(section.title)
                            .font(.system(size: 9.5, weight: .semibold, design: .rounded))
                            .lineLimit(1)
                    }
                    .foregroundStyle(selectedSection == section ? Color.white : Color.white.opacity(0.48))
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
                    .background {
                        if selectedSection == section {
                            Capsule()
                                .fill(.white.opacity(0.10))
                                .overlay {
                                    Capsule().stroke(.white.opacity(0.14), lineWidth: 0.7)
                                }
                                .padding(.horizontal, 2)
                        }
                    }
                }
                .buttonStyle(.plain)
            }
        }
        .padding(6)
        .background(.ultraThinMaterial, in: Capsule())
        .overlay {
            Capsule()
                .stroke(
                    LinearGradient(
                        colors: [.white.opacity(0.25), .white.opacity(0.07)],
                        startPoint: .top,
                        endPoint: .bottom
                    ),
                    lineWidth: 0.8
                )
        }
        .shadow(color: .black.opacity(0.30), radius: 24, y: 12)
    }

    private var launchOverlay: some View {
        ZStack {
            appBackground
            VStack(spacing: 18) {
                SynFlixMark(size: 92)
                    .shadow(color: Color(red: 0.47, green: 0.36, blue: 1).opacity(0.45), radius: 34)
                VStack(spacing: 6) {
                    Text("SynFlix")
                        .font(.system(size: 32, weight: .bold, design: .rounded))
                        .tracking(-0.8)
                    Text("Your cinema, beautifully connected.")
                        .font(.system(size: 13.5, weight: .medium))
                        .foregroundStyle(.white.opacity(0.48))
                }
                ProgressView()
                    .tint(.white.opacity(0.85))
                    .controlSize(.regular)
                    .padding(.top, 4)
            }
            .padding(34)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 34, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 34, style: .continuous)
                    .stroke(.white.opacity(0.12), lineWidth: 0.8)
            }
            .shadow(color: .black.opacity(0.38), radius: 34, y: 18)
            .padding(28)
        }
        .ignoresSafeArea()
    }

    private func errorCard(_ message: String) -> some View {
        VStack(spacing: 14) {
            Image(systemName: "wifi.exclamationmark")
                .font(.system(size: 28, weight: .semibold))
                .foregroundStyle(.white.opacity(0.82))
            VStack(spacing: 5) {
                Text("Couldn’t connect")
                    .font(.system(size: 18, weight: .semibold, design: .rounded))
                Text(message)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(.white.opacity(0.48))
                    .multilineTextAlignment(.center)
                    .lineLimit(3)
            }
            Button("Try Again") { browser.reload() }
                .font(.system(size: 13, weight: .semibold, design: .rounded))
                .foregroundStyle(.white)
                .padding(.horizontal, 18)
                .frame(height: 40)
                .background(
                    LinearGradient(
                        colors: [Color(red: 0.54, green: 0.42, blue: 1), Color(red: 0.32, green: 0.54, blue: 1)],
                        startPoint: .leading,
                        endPoint: .trailing
                    ),
                    in: Capsule()
                )
        }
        .padding(24)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(.white.opacity(0.13), lineWidth: 0.8))
    }
}

private struct SynFlixMark: View {
    let size: CGFloat

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.26, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [
                            Color(red: 0.48, green: 0.31, blue: 1.0),
                            Color(red: 0.22, green: 0.48, blue: 1.0)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .overlay {
                    RoundedRectangle(cornerRadius: size * 0.26, style: .continuous)
                        .stroke(.white.opacity(0.28), lineWidth: max(0.7, size * 0.012))
                }

            RoundedRectangle(cornerRadius: size * 0.17, style: .continuous)
                .fill(.white.opacity(0.12))
                .frame(width: size * 0.61, height: size * 0.61)
                .rotationEffect(.degrees(45))

            Image(systemName: "play.fill")
                .font(.system(size: size * 0.32, weight: .black))
                .foregroundStyle(.white)
                .offset(x: size * 0.025)
        }
        .frame(width: size, height: size)
        .shadow(color: Color(red: 0.42, green: 0.34, blue: 1).opacity(0.24), radius: size * 0.18, y: size * 0.08)
    }
}

struct SynFlixWebView: UIViewRepresentable {
    @ObservedObject var model: SynFlixBrowserModel

    func makeCoordinator() -> Coordinator {
        Coordinator(model: model)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.allowsPictureInPictureMediaPlayback = true
        configuration.allowsAirPlayForMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true

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
        webView.scrollView.backgroundColor = UIColor(red: 0.025, green: 0.03, blue: 0.055, alpha: 1)
        webView.scrollView.keyboardDismissMode = .interactive
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic
        webView.customUserAgent = "SynFlix-iOS/1.1 Mobile Safari WebKit"

        let refresh = UIRefreshControl()
        refresh.tintColor = UIColor.white.withAlphaComponent(0.72)
        refresh.addTarget(context.coordinator, action: #selector(Coordinator.refresh(_:)), for: .valueChanged)
        webView.scrollView.refreshControl = refresh

        model.webView = webView
        model.isLoading = true
        model.isInitialLoad = true
        webView.load(URLRequest(url: model.initialURL, cachePolicy: .reloadRevalidatingCacheData, timeoutInterval: 30))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        model.webView = webView
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        private let model: SynFlixBrowserModel
        private let allowedHost = "synscraper-tffk.vercel.app"

        init(model: SynFlixBrowserModel) {
            self.model = model
        }

        @objc func refresh(_ sender: UIRefreshControl) {
            model.reload()
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            model.isLoading = true
            model.errorMessage = nil
        }

        func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
            model.sync(from: webView)
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            webView.scrollView.refreshControl?.endRefreshing()
            model.isLoading = false
            model.isInitialLoad = false
            model.errorMessage = nil
            model.sync(from: webView)
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            finishFailure(webView, error: error)
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            finishFailure(webView, error: error)
        }

        private func finishFailure(_ webView: WKWebView, error: Error) {
            webView.scrollView.refreshControl?.endRefreshing()
            let nsError = error as NSError
            if nsError.code == NSURLErrorCancelled { return }
            model.isLoading = false
            model.isInitialLoad = false
            model.errorMessage = "Check your connection and try again."
            model.sync(from: webView)
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }

            if let host = url.host,
               host != allowedHost,
               navigationAction.navigationType == .linkActivated {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }

            decisionHandler(.allow)
        }

        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            if navigationAction.targetFrame == nil, let requestURL = navigationAction.request.url {
                if requestURL.host == allowedHost {
                    webView.load(URLRequest(url: requestURL))
                } else {
                    UIApplication.shared.open(requestURL)
                }
            }
            return nil
        }
    }
}
