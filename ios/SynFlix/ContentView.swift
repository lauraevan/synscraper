import SwiftUI
import WebKit
import UIKit
import Combine
import Network

enum AppSection: String, CaseIterable, Identifiable {
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

private extension View {
    @ViewBuilder
    func synflixLiquidGlass<S: Shape>(in shape: S, interactive: Bool = false) -> some View {
        if #available(iOS 26.0, *) {
            if interactive {
                self.glassEffect(.regular.interactive(), in: shape)
            } else {
                self.glassEffect(.regular, in: shape)
            }
        } else {
            self.background(.ultraThinMaterial, in: shape)
        }
    }
}

final class SynFlixBrowserModel: ObservableObject {
    @Published var isLoading = true
    @Published var isInitialLoad = true
    @Published var hasRenderedPage = false
    @Published var canGoBack = false
    @Published var canGoForward = false
    @Published var pageTitle = "SynFlix"
    @Published var errorMessage: String?
    @Published var isOnline = true
    @Published var lastUpdated: Date?

    weak var webView: WKWebView?
    private(set) var initialURL: URL

    private let allowedHost = "synscraper-tffk.vercel.app"
    private let monitor = NWPathMonitor()
    private let monitorQueue = DispatchQueue(label: "app.synflix.network-monitor", qos: .utility)
    private var currentURL = AppSection.home.url

    init() {
        if let saved = UserDefaults.standard.string(forKey: "synflix.lastURL"),
           let savedURL = URL(string: saved),
           savedURL.host == allowedHost {
            initialURL = savedURL
            currentURL = savedURL
        } else {
            initialURL = AppSection.home.url
        }

        monitor.pathUpdateHandler = { [weak self] path in
            let online = path.status == .satisfied
            DispatchQueue.main.async {
                self?.isOnline = online
            }
        }
        monitor.start(queue: monitorQueue)
    }

    deinit {
        monitor.cancel()
    }

    func navigate(to section: AppSection) {
        UISelectionFeedbackGenerator().selectionChanged()
        load(section.url)
    }

    func load(_ url: URL, forceNetwork: Bool = false) {
        currentURL = url
        errorMessage = nil
        isLoading = true

        let policy: NSURLRequest.CachePolicy
        if forceNetwork && isOnline {
            policy = .reloadRevalidatingCacheData
        } else if isOnline {
            policy = .useProtocolCachePolicy
        } else {
            policy = .returnCacheDataElseLoad
        }

        let request = URLRequest(
            url: url,
            cachePolicy: policy,
            timeoutInterval: isOnline ? 12 : 3
        )

        if let webView {
            webView.load(request)
        } else {
            initialURL = url
        }
    }

    func reload() {
        load(webView?.url ?? currentURL, forceNetwork: true)
    }

    func openCachedHome() {
        load(AppSection.home.url)
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
        let trimmedTitle = webView.title?.trimmingCharacters(in: .whitespacesAndNewlines)
        pageTitle = (trimmedTitle?.isEmpty == false ? trimmedTitle : nil) ?? "SynFlix"
    }

    func navigationFinished(_ webView: WKWebView) {
        isLoading = false
        isInitialLoad = false
        hasRenderedPage = true
        errorMessage = nil
        lastUpdated = Date()
        sync(from: webView)

        if let url = webView.url, url.host == allowedHost {
            currentURL = url
            UserDefaults.standard.set(url.absoluteString, forKey: "synflix.lastURL")
        }

        warmOfflineCache(in: webView)
    }

    func navigationFailed(_ webView: WKWebView, error: Error) {
        let nsError = error as NSError
        if nsError.code == NSURLErrorCancelled { return }

        isLoading = false
        isInitialLoad = false
        sync(from: webView)

        if hasRenderedPage {
            errorMessage = nil
            return
        }

        errorMessage = isOnline
            ? "SynFlix couldn't reach the service. Your saved shell is still available."
            : "You're offline. Recent SynFlix screens and artwork are available when cached."
    }

    private func warmOfflineCache(in webView: WKWebView) {
        let script = """
        (() => {
          const urls = [
            '/?iosApp=1',
            '/search?iosApp=1',
            '/my-list?iosApp=1',
            '/settings?iosApp=1'
          ];
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then((registration) => {
              const worker = registration.active || registration.waiting || registration.installing;
              worker?.postMessage({ type: 'WARM_CACHE', urls });
            }).catch(() => {});
          }
        })();
        """
        webView.evaluateJavaScript(script, completionHandler: nil)
    }
}

struct ContentView: View {
    @StateObject private var browser = SynFlixBrowserModel()
    @State private var selectedSection: AppSection = .home
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var body: some View {
        ZStack {
            appBackground

            SynFlixWebView(model: browser)
                .ignoresSafeArea()
                .overlay(alignment: .top) {
                    LinearGradient(
                        colors: [
                            Color.black.opacity(0.54),
                            Color.black.opacity(0.20),
                            Color.clear
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                    .frame(height: 132)
                    .allowsHitTesting(false)
                }
                .overlay(alignment: .bottom) {
                    LinearGradient(
                        colors: [
                            Color.clear,
                            Color.black.opacity(0.16),
                            Color.black.opacity(0.52)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                    .frame(height: 150)
                    .allowsHitTesting(false)
                }

            VStack(spacing: 0) {
                topChrome
                    .padding(.horizontal, 12)
                    .padding(.top, 8)

                Spacer(minLength: 0)

                if !browser.isOnline {
                    offlineStatusPill
                        .padding(.bottom, 8)
                        .transition(.opacity.combined(with: .move(edge: .bottom)))
                }

                bottomDock
                    .frame(maxWidth: horizontalSizeClass == .regular ? 560 : .infinity)
                    .padding(.horizontal, horizontalSizeClass == .regular ? 28 : 12)
                    .padding(.bottom, 8)
            }

            if let message = browser.errorMessage, !browser.hasRenderedPage {
                offlineFallback(message)
                    .padding(24)
                    .frame(maxWidth: 460)
                    .transition(.opacity.combined(with: .scale(scale: 0.98)))
                    .zIndex(10)
            }

            if browser.isInitialLoad {
                launchOverlay
                    .transition(.opacity)
                    .zIndex(20)
            }
        }
        .preferredColorScheme(.dark)
        .tint(Color(red: 0.67, green: 0.62, blue: 1.0))
        .animation(.easeOut(duration: 0.22), value: browser.isOnline)
        .animation(.easeOut(duration: 0.20), value: browser.isInitialLoad)
    }

    private var appBackground: some View {
        ZStack {
            Color(red: 0.018, green: 0.022, blue: 0.040)
            RadialGradient(
                colors: [
                    Color(red: 0.30, green: 0.20, blue: 0.70).opacity(0.25),
                    Color.clear
                ],
                center: .topTrailing,
                startRadius: 8,
                endRadius: 560
            )
            RadialGradient(
                colors: [
                    Color(red: 0.08, green: 0.30, blue: 0.68).opacity(0.18),
                    Color.clear
                ],
                center: .bottomLeading,
                startRadius: 14,
                endRadius: 620
            )
        }
        .ignoresSafeArea()
    }

    private var topChrome: some View {
        HStack(spacing: 8) {
            HStack(spacing: 9) {
                SynFlixMark(size: 34)

                if horizontalSizeClass == .regular {
                    VStack(alignment: .leading, spacing: 0) {
                        Text("SynFlix")
                            .font(.system(size: 15.5, weight: .semibold, design: .rounded))
                            .tracking(-0.25)
                        Text(contextSubtitle)
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(.white.opacity(0.46))
                            .lineLimit(1)
                    }
                }
            }

            Spacer(minLength: 6)

            if horizontalSizeClass == .regular {
                Text(selectedSection.title)
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white.opacity(0.58))
                    .lineLimit(1)
            }

            Spacer(minLength: 6)

            if browser.canGoBack {
                glassIconButton("chevron.left") {
                    browser.goBack()
                }
            }

            glassIconButton("magnifyingglass") {
                selectedSection = .search
                browser.navigate(to: .search)
            }

            glassIconButton(browser.isLoading ? "xmark" : "arrow.clockwise") {
                if browser.isLoading {
                    browser.webView?.stopLoading()
                    browser.isLoading = false
                } else {
                    browser.reload()
                }
            }
        }
        .padding(7)
        .padding(.leading, 2)
        .frame(height: 52)
        .synflixLiquidGlass(in: Capsule())
        .overlay {
            Capsule()
                .stroke(
                    LinearGradient(
                        colors: [.white.opacity(0.20), .white.opacity(0.035)],
                        startPoint: .top,
                        endPoint: .bottom
                    ),
                    lineWidth: 0.7
                )
        }
        .shadow(color: .black.opacity(0.24), radius: 20, y: 8)
    }

    private var contextSubtitle: String {
        if !browser.isOnline { return "Offline · saved content" }
        if browser.isLoading { return "Updating" }
        return browser.pageTitle == "SynFlix" ? "Your cinema" : browser.pageTitle
    }

    private func glassIconButton(_ symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: {
            UIImpactFeedbackGenerator(style: .soft).impactOccurred()
            action()
        }) {
            Image(systemName: symbol)
                .font(.system(size: 14, weight: .semibold))
                .symbolRenderingMode(.hierarchical)
                .foregroundStyle(.white.opacity(0.86))
                .frame(width: 38, height: 38)
        }
        .buttonStyle(.plain)
        .synflixLiquidGlass(in: Circle(), interactive: true)
        .overlay(Circle().stroke(.white.opacity(0.08), lineWidth: 0.6))
        .accessibilityAddTraits(.isButton)
    }

    private var bottomDock: some View {
        HStack(spacing: 2) {
            ForEach(AppSection.allCases) { section in
                Button {
                    selectedSection = section
                    browser.navigate(to: section)
                } label: {
                    VStack(spacing: 3.5) {
                        Image(systemName: section.symbol)
                            .font(.system(size: 17, weight: .semibold))
                            .symbolRenderingMode(.hierarchical)
                        Text(section.title)
                            .font(.system(size: 9.5, weight: .semibold, design: .rounded))
                            .lineLimit(1)
                    }
                    .foregroundStyle(selectedSection == section ? Color.white : Color.white.opacity(0.46))
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .contentShape(Rectangle())
                    .background {
                        if selectedSection == section {
                            Capsule()
                                .fill(Color.white.opacity(0.085))
                                .overlay {
                                    Capsule().stroke(Color.white.opacity(0.10), lineWidth: 0.6)
                                }
                                .padding(.horizontal, 2)
                        }
                    }
                }
                .buttonStyle(.plain)
                .accessibilityLabel(section.title)
                .accessibilityAddTraits(selectedSection == section ? [.isSelected] : [])
            }
        }
        .padding(6)
        .synflixLiquidGlass(in: Capsule())
        .overlay {
            Capsule()
                .stroke(
                    LinearGradient(
                        colors: [.white.opacity(0.20), .white.opacity(0.035)],
                        startPoint: .top,
                        endPoint: .bottom
                    ),
                    lineWidth: 0.7
                )
        }
        .shadow(color: .black.opacity(0.30), radius: 24, y: 12)
    }

    private var offlineStatusPill: some View {
        HStack(spacing: 7) {
            Circle()
                .fill(Color.orange.opacity(0.95))
                .frame(width: 6, height: 6)
            Text("Offline · showing saved SynFlix")
                .font(.system(size: 11, weight: .semibold, design: .rounded))
                .foregroundStyle(.white.opacity(0.82))
        }
        .padding(.horizontal, 12)
        .frame(height: 32)
        .synflixLiquidGlass(in: Capsule())
        .overlay(Capsule().stroke(.white.opacity(0.08), lineWidth: 0.6))
    }

    private var launchOverlay: some View {
        ZStack {
            appBackground
            VStack(spacing: 20) {
                SynFlixMark(size: 108)
                    .shadow(color: Color(red: 0.45, green: 0.36, blue: 1).opacity(0.46), radius: 40)
                VStack(spacing: 5) {
                    Text("SynFlix")
                        .font(.system(size: 34, weight: .bold, design: .rounded))
                        .tracking(-1.0)
                    Text(browser.isOnline ? "Preparing your cinema" : "Opening saved SynFlix")
                        .font(.system(size: 13.5, weight: .medium, design: .rounded))
                        .foregroundStyle(.white.opacity(0.46))
                }
                ProgressView()
                    .controlSize(.regular)
                    .tint(.white.opacity(0.84))
                    .padding(.top, 3)
            }
            .padding(.horizontal, 36)
        }
        .ignoresSafeArea()
    }

    private func offlineFallback(_ message: String) -> some View {
        VStack(spacing: 18) {
            ZStack {
                Circle()
                    .fill(.white.opacity(0.07))
                    .frame(width: 58, height: 58)
                Image(systemName: browser.isOnline ? "exclamationmark.icloud.fill" : "icloud.slash.fill")
                    .font(.system(size: 24, weight: .semibold))
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(.white.opacity(0.86))
            }

            VStack(spacing: 6) {
                Text(browser.isOnline ? "SynFlix is taking a moment" : "You're offline")
                    .font(.system(size: 20, weight: .semibold, design: .rounded))
                    .tracking(-0.3)
                Text(message)
                    .font(.system(size: 12.5, weight: .medium))
                    .foregroundStyle(.white.opacity(0.48))
                    .multilineTextAlignment(.center)
                    .lineSpacing(2)
            }

            HStack(spacing: 10) {
                Button("Saved Home") {
                    browser.openCachedHome()
                }
                .font(.system(size: 12.5, weight: .semibold, design: .rounded))
                .foregroundStyle(.white.opacity(0.82))
                .padding(.horizontal, 16)
                .frame(height: 40)
                .synflixLiquidGlass(in: Capsule(), interactive: true)

                if browser.isOnline {
                    Button("Try Again") {
                        browser.reload()
                    }
                    .font(.system(size: 12.5, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 18)
                    .frame(height: 40)
                    .background(
                        LinearGradient(
                            colors: [
                                Color(red: 0.50, green: 0.39, blue: 1.0),
                                Color(red: 0.27, green: 0.50, blue: 1.0)
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        ),
                        in: Capsule()
                    )
                }
            }
        }
        .padding(.horizontal, 28)
        .padding(.vertical, 26)
        .synflixLiquidGlass(in: RoundedRectangle(cornerRadius: 30, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 30, style: .continuous)
                .stroke(.white.opacity(0.10), lineWidth: 0.7)
        }
        .shadow(color: .black.opacity(0.34), radius: 32, y: 18)
    }
}

private struct SynFlixMark: View {
    let size: CGFloat

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.28, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [
                            Color(red: 0.55, green: 0.35, blue: 1.0),
                            Color(red: 0.24, green: 0.50, blue: 1.0)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .overlay {
                    RoundedRectangle(cornerRadius: size * 0.28, style: .continuous)
                        .stroke(.white.opacity(0.24), lineWidth: max(0.7, size * 0.011))
                }

            RoundedRectangle(cornerRadius: size * 0.15, style: .continuous)
                .fill(.white.opacity(0.12))
                .frame(width: size * 0.60, height: size * 0.60)
                .rotationEffect(.degrees(45))

            Image(systemName: "play.fill")
                .font(.system(size: size * 0.35, weight: .black))
                .foregroundStyle(.white)
                .offset(x: size * 0.025)
        }
        .frame(width: size, height: size)
        .shadow(color: Color(red: 0.43, green: 0.34, blue: 1).opacity(0.26), radius: size * 0.16, y: size * 0.07)
    }
}

struct SynFlixWebView: UIViewRepresentable {
    @ObservedObject var model: SynFlixBrowserModel

    func makeCoordinator() -> Coordinator {
        Coordinator(model: model)
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
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true

        let appBridge = WKUserScript(
            source: """
            window.__SYNFLIX_IOS__ = true;
            document.documentElement.classList.add('synflix-ios-app');
            document.documentElement.dataset.synflixIos = 'true';
            """,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        configuration.userContentController.addUserScript(appBridge)

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.allowsLinkPreview = true
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.underPageBackgroundColor = UIColor(red: 0.018, green: 0.022, blue: 0.040, alpha: 1)
        webView.scrollView.backgroundColor = webView.underPageBackgroundColor
        webView.scrollView.keyboardDismissMode = .interactive
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.decelerationRate = .normal
        webView.scrollView.alwaysBounceVertical = true
        webView.customUserAgent = "SynFlix-iOS/1.3 Mobile Safari WebKit"

        let refresh = UIRefreshControl()
        refresh.tintColor = UIColor.white.withAlphaComponent(0.66)
        refresh.addTarget(context.coordinator, action: #selector(Coordinator.refresh(_:)), for: .valueChanged)
        webView.scrollView.refreshControl = refresh

        model.webView = webView
        model.isLoading = true
        model.isInitialLoad = true

        let policy: NSURLRequest.CachePolicy = model.isOnline ? .useProtocolCachePolicy : .returnCacheDataElseLoad
        webView.load(
            URLRequest(
                url: model.initialURL,
                cachePolicy: policy,
                timeoutInterval: model.isOnline ? 12 : 3
            )
        )

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
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
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
            model.navigationFinished(webView)
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            webView.scrollView.refreshControl?.endRefreshing()
            model.navigationFailed(webView, error: error)
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            webView.scrollView.refreshControl?.endRefreshing()
            model.navigationFailed(webView, error: error)
        }

        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            model.load(webView.url ?? AppSection.home.url)
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
            guard navigationAction.targetFrame == nil,
                  let requestURL = navigationAction.request.url else {
                return nil
            }

            if requestURL.host == allowedHost {
                webView.load(URLRequest(url: requestURL, cachePolicy: .useProtocolCachePolicy, timeoutInterval: 12))
            } else {
                UIApplication.shared.open(requestURL)
            }

            return nil
        }
    }
}
