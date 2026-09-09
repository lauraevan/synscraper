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
        case .settings: return "gearshape.fill"
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

    static func section(for url: URL?) -> AppSection? {
        guard let path = url?.path else { return nil }
        if path == "/" || path.isEmpty { return .home }
        if path.hasPrefix("/search") { return .search }
        if path.hasPrefix("/my-list") { return .library }
        if path.hasPrefix("/settings") { return .settings }
        return nil
    }
}

private extension Color {
    init(hex: String) {
        let clean = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var value: UInt64 = 0
        Scanner(string: clean).scanHexInt64(&value)
        let r, g, b: UInt64
        switch clean.count {
        case 6:
            r = (value >> 16) & 0xff
            g = (value >> 8) & 0xff
            b = value & 0xff
        default:
            r = 255
            g = 212
            b = 0
        }
        self.init(
            .sRGB,
            red: Double(r) / 255.0,
            green: Double(g) / 255.0,
            blue: Double(b) / 255.0,
            opacity: 1
        )
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
    @Published var currentSection: AppSection = .home
    @Published var isPlayerSurface = false
    @Published var themeID = "synflix"
    @Published var accentHex = "#ffd400"

    weak var webView: WKWebView?
    private(set) var initialURL: URL

    private let allowedHost = "synscraper-tffk.vercel.app"
    private let monitor = NWPathMonitor()
    private let monitorQueue = DispatchQueue(label: "app.synflix.network-monitor", qos: .utility)
    private var currentURL = AppSection.home.url

    private let themeAccents: [String: String] = [
        "synflix": "#ffd400",
        "aqua": "#54e7f1",
        "autumn": "#ff9d42",
        "cherri": "#ff5d8f",
        "evergreen": "#64d98b",
        "rose": "#ff91ad",
        "violet": "#a78bfa",
        "purple": "#8b5cf6",
        "red": "#ff4d55",
        "monochrome": "#f4f4f4",
        "noir": "#c8c8c8",
        "teal": "#35d0ba",
    ]

    init() {
        if let saved = UserDefaults.standard.string(forKey: "synflix.lastURL"),
           let savedURL = URL(string: saved),
           savedURL.host == allowedHost {
            initialURL = savedURL
            currentURL = savedURL
            currentSection = AppSection.section(for: savedURL) ?? .home
            isPlayerSurface = Self.playerSurface(savedURL)
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

    var accentColor: Color { Color(hex: accentHex) }

    func navigate(to section: AppSection) {
        UISelectionFeedbackGenerator().selectionChanged()

        if currentSection == section, let webView {
            webView.scrollView.setContentOffset(
                CGPoint(x: 0, y: -webView.scrollView.adjustedContentInset.top),
                animated: true
            )
            return
        }

        currentSection = section
        load(section.url)
    }

    func load(_ url: URL, forceNetwork: Bool = false) {
        currentURL = url
        errorMessage = nil
        isLoading = true
        updateSurface(for: url)

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
        currentSection = .home
        load(AppSection.home.url)
    }

    func goBack() {
        webView?.goBack()
    }

    func sync(from webView: WKWebView) {
        canGoBack = webView.canGoBack
        canGoForward = webView.canGoForward

        let trimmedTitle = webView.title?.trimmingCharacters(in: .whitespacesAndNewlines)
        pageTitle = (trimmedTitle?.isEmpty == false ? trimmedTitle : nil) ?? "SynFlix"

        if let section = AppSection.section(for: webView.url) {
            currentSection = section
        }
        updateSurface(for: webView.url)
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
            ? "SynFlix couldn't reach the service. Your saved library is still available."
            : "You're offline. Recently loaded screens, artwork, and saved titles remain available when cached."
    }

    func updateTheme(id: String, accent: String?) {
        let normalizedID = themeAccents[id] == nil ? "synflix" : id
        let proposed = accent?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let normalizedAccent = proposed.hasPrefix("#") && proposed.count == 7
            ? proposed
            : (themeAccents[normalizedID] ?? "#ffd400")

        if themeID != normalizedID { themeID = normalizedID }
        if accentHex.lowercased() != normalizedAccent.lowercased() {
            accentHex = normalizedAccent
        }
    }

    private func updateSurface(for url: URL?) {
        isPlayerSurface = Self.playerSurface(url)
    }

    private static func playerSurface(_ url: URL?) -> Bool {
        guard let path = url?.path else { return false }
        return path.hasPrefix("/watch/") || path.hasPrefix("/embed/")
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
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var body: some View {
        ZStack {
            Color(red: 0.027, green: 0.027, blue: 0.024)
                .ignoresSafeArea()

            SynFlixWebView(model: browser)
                .ignoresSafeArea()

            if !browser.isPlayerSurface {
                VStack(spacing: 0) {
                    topBar
                    Spacer(minLength: 0)

                    if !browser.isOnline {
                        offlineBanner
                            .padding(.horizontal, 14)
                            .padding(.bottom, 8)
                    }

                    tabBar
                }
                .transition(.opacity)
            }

            if let message = browser.errorMessage, !browser.hasRenderedPage {
                offlineFallback(message)
                    .padding(24)
                    .frame(maxWidth: 440)
                    .zIndex(10)
            }

            if browser.isInitialLoad {
                launchOverlay
                    .zIndex(20)
            }
        }
        .preferredColorScheme(.dark)
        .tint(browser.accentColor)
        .animation(.easeOut(duration: 0.18), value: browser.isOnline)
        .animation(.easeOut(duration: 0.16), value: browser.isInitialLoad)
        .animation(.easeOut(duration: 0.16), value: browser.isPlayerSurface)
    }

    private var topBar: some View {
        HStack(spacing: 12) {
            HStack(spacing: 10) {
                SynFlixBrandMark(size: 32)

                Text("SynFlix")
                    .font(.system(size: 17, weight: .semibold))
                    .tracking(-0.35)

                if horizontalSizeClass == .regular {
                    Rectangle()
                        .fill(.white.opacity(0.12))
                        .frame(width: 1, height: 17)

                    Text(browser.currentSection.title)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(.white.opacity(0.50))
                }
            }

            Spacer(minLength: 8)

            if browser.isLoading {
                ProgressView()
                    .controlSize(.small)
                    .tint(browser.accentColor)
                    .frame(width: 28, height: 36)
            }

            if browser.canGoBack {
                chromeButton("chevron.left") {
                    browser.goBack()
                }
            }

            chromeButton("arrow.clockwise") {
                browser.reload()
            }
        }
        .padding(.horizontal, horizontalSizeClass == .regular ? 20 : 14)
        .frame(height: 54)
        .background(.ultraThinMaterial)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(.white.opacity(0.075))
                .frame(height: 0.5)
        }
    }

    private func chromeButton(_ symbol: String, action: @escaping () -> Void) -> some View {
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            action()
        } label: {
            Image(systemName: symbol)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(.white.opacity(0.72))
                .frame(width: 36, height: 36)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(.isButton)
    }

    private var tabBar: some View {
        HStack(spacing: 0) {
            ForEach(AppSection.allCases) { section in
                Button {
                    browser.navigate(to: section)
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: section.symbol)
                            .font(.system(size: 17, weight: .semibold))
                            .symbolRenderingMode(.hierarchical)

                        Text(section.title)
                            .font(.system(size: 10, weight: .medium))
                            .lineLimit(1)
                    }
                    .foregroundStyle(
                        browser.currentSection == section
                            ? browser.accentColor
                            : Color.white.opacity(0.43)
                    )
                    .frame(maxWidth: .infinity)
                    .frame(height: 56)
                    .contentShape(Rectangle())
                    .overlay(alignment: .top) {
                        if browser.currentSection == section {
                            Capsule()
                                .fill(browser.accentColor)
                                .frame(width: 24, height: 2)
                        }
                    }
                }
                .buttonStyle(.plain)
                .accessibilityLabel(section.title)
                .accessibilityAddTraits(browser.currentSection == section ? [.isSelected] : [])
            }
        }
        .padding(.horizontal, horizontalSizeClass == .regular ? 120 : 4)
        .padding(.top, 4)
        .background(.ultraThinMaterial)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(.white.opacity(0.075))
                .frame(height: 0.5)
        }
    }

    private var offlineBanner: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(browser.accentColor)
                .frame(width: 6, height: 6)

            Text("Offline · showing saved SynFlix")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.white.opacity(0.72))
        }
        .padding(.horizontal, 12)
        .frame(height: 32)
        .background(Color.black.opacity(0.72), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(.white.opacity(0.08), lineWidth: 0.5)
        }
    }

    private var launchOverlay: some View {
        ZStack {
            Color(red: 0.027, green: 0.027, blue: 0.024)

            VStack(spacing: 18) {
                SynFlixBrandMark(size: 88)

                Text("SynFlix")
                    .font(.system(size: 28, weight: .semibold))
                    .tracking(-0.8)

                ProgressView()
                    .controlSize(.regular)
                    .tint(browser.accentColor)
                    .padding(.top, 2)
            }
        }
        .ignoresSafeArea()
    }

    private func offlineFallback(_ message: String) -> some View {
        VStack(spacing: 18) {
            SynFlixBrandMark(size: 52)

            VStack(spacing: 7) {
                Text(browser.isOnline ? "Unable to connect" : "You're offline")
                    .font(.system(size: 20, weight: .semibold))
                    .tracking(-0.35)

                Text(message)
                    .font(.system(size: 13, weight: .regular))
                    .foregroundStyle(.white.opacity(0.48))
                    .multilineTextAlignment(.center)
                    .lineSpacing(2)
            }

            HStack(spacing: 10) {
                Button("Saved Home") {
                    browser.openCachedHome()
                }
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.white.opacity(0.86))
                .padding(.horizontal, 16)
                .frame(height: 40)
                .background(Color.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(.white.opacity(0.09), lineWidth: 0.5)
                }

                if browser.isOnline {
                    Button("Try Again") {
                        browser.reload()
                    }
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.black)
                    .padding(.horizontal, 18)
                    .frame(height: 40)
                    .background(browser.accentColor, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                }
            }
        }
        .padding(.horizontal, 28)
        .padding(.vertical, 26)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(.white.opacity(0.09), lineWidth: 0.6)
        }
        .shadow(color: .black.opacity(0.28), radius: 24, y: 14)
    }
}

private struct SynFlixBrandMark: View {
    let size: CGFloat

    var body: some View {
        Group {
            if let image = UIImage(named: "SynFlixLogo") {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
            } else {
                ZStack {
                    RoundedRectangle(cornerRadius: size * 0.20, style: .continuous)
                        .fill(Color(red: 1.0, green: 0.83, blue: 0.0))
                    Text("S")
                        .font(.system(size: size * 0.50, weight: .black))
                        .foregroundStyle(.black)
                }
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
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

        configuration.userContentController.add(context.coordinator, name: "synflixTheme")

        let runtimeBridge = WKUserScript(
            source: """
            window.__SYNFLIX_IOS__ = true;
            document.documentElement.classList.add('synflix-ios-app');
            document.documentElement.dataset.synflixIos = 'true';
            """,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        configuration.userContentController.addUserScript(runtimeBridge)

        let themeBridge = WKUserScript(
            source: """
            (() => {
              const fallback = {
                synflix:'#ffd400', aqua:'#54e7f1', autumn:'#ff9d42', cherri:'#ff5d8f',
                evergreen:'#64d98b', rose:'#ff91ad', violet:'#a78bfa', purple:'#8b5cf6',
                red:'#ff4d55', monochrome:'#f4f4f4', noir:'#c8c8c8', teal:'#35d0ba'
              };

              const sendTheme = () => {
                const root = document.documentElement;
                const id = root.dataset.siteTheme || 'synflix';
                const surface = document.querySelector('.synflix-site');
                const computed = surface
                  ? getComputedStyle(surface).getPropertyValue('--site-accent').trim()
                  : '';
                const accent = computed || fallback[id] || fallback.synflix;
                try {
                  window.webkit.messageHandlers.synflixTheme.postMessage({ id, accent });
                } catch (_) {}
              };

              window.addEventListener('synflix-preferences', sendTheme);
              new MutationObserver(sendTheme).observe(document.documentElement, {
                attributes: true,
                attributeFilter: ['data-site-theme']
              });

              requestAnimationFrame(sendTheme);
              setTimeout(sendTheme, 180);
            })();
            """,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true
        )
        configuration.userContentController.addUserScript(themeBridge)

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.allowsLinkPreview = false
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.027, green: 0.027, blue: 0.024, alpha: 1)
        webView.underPageBackgroundColor = webView.backgroundColor
        webView.scrollView.backgroundColor = webView.backgroundColor
        webView.scrollView.keyboardDismissMode = .interactive
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.decelerationRate = .normal
        webView.scrollView.alwaysBounceVertical = true
        webView.customUserAgent = "SynFlix-iOS/1.4 Mobile Safari WebKit"

        let refresh = UIRefreshControl()
        refresh.tintColor = UIColor.white.withAlphaComponent(0.55)
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

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        private let model: SynFlixBrowserModel
        private let allowedHost = "synscraper-tffk.vercel.app"

        init(model: SynFlixBrowserModel) {
            self.model = model
        }

        @objc func refresh(_ sender: UIRefreshControl) {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            model.reload()
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "synflixTheme",
                  let body = message.body as? [String: Any],
                  let id = body["id"] as? String else {
                return
            }

            let accent = body["accent"] as? String
            DispatchQueue.main.async {
                self.model.updateTheme(id: id, accent: accent)
            }
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
                webView.load(
                    URLRequest(
                        url: requestURL,
                        cachePolicy: .useProtocolCachePolicy,
                        timeoutInterval: 12
                    )
                )
            } else {
                UIApplication.shared.open(requestURL)
            }

            return nil
        }
    }
}
