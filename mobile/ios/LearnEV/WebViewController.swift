import UIKit
import WebKit

final class WebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    private var webView: WKWebView?
    private var origin: String?
    private let status = UILabel()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor { $0.userInterfaceStyle == .dark ? UIColor(white: 27 / 255, alpha: 1) : .white }
        status.text = "正在打开 LearnEV…"
        status.textColor = .secondaryLabel
        status.textAlignment = .center
        status.numberOfLines = 0
        status.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(status)
        NSLayoutConstraint.activate([
            status.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            status.leadingAnchor.constraint(equalTo: view.layoutMarginsGuide.leadingAnchor),
            status.trailingAnchor.constraint(equalTo: view.layoutMarginsGuide.trailingAnchor),
        ])
        NodeRuntime.shared.onExit = { [weak self] message in self?.fail(message) }
        NodeRuntime.shared.start { [weak self] result in
            switch result {
            case .success(let port): self?.open(port: port)
            case .failure(let failure): self?.fail(failure.message)
            }
        }
    }

    private func fail(_ message: String) {
        webView?.removeFromSuperview()
        webView = nil
        status.text = "LearnEV 启动失败，请关闭后重新打开应用。\n\n" + message
        status.isHidden = false
    }

    private func open(port: Int) {
        let origin = "http://127.0.0.1:\(port)"
        self.origin = origin
        // Cookies ignore ports: block every other loopback server so none of them receives the session cookie.
        let rules = #"""
        [{"trigger": {"url-filter": "^[a-z]+://127\\.0\\.0\\.1[:/]"}, "action": {"type": "block"}},
         {"trigger": {"url-filter": "^http://127\\.0\\.0\\.1:\#(port)/"}, "action": {"type": "ignore-previous-rules"}}]
        """#
        WKContentRuleListStore.default().compileContentRuleList(forIdentifier: "loopback", encodedContentRuleList: rules) { [weak self] list, error in
            guard let self else { return }
            guard let list else { return self.fail(error?.localizedDescription ?? "Content rules failed.") }
            let configuration = WKWebViewConfiguration()
            configuration.websiteDataStore = .default()
            configuration.userContentController.add(list)
            let cookie = HTTPCookie(properties: [
                .domain: "127.0.0.1", .path: "/", .name: "learnev", .value: NodeRuntime.shared.token,
                HTTPCookiePropertyKey("HttpOnly"): "TRUE", .sameSitePolicy: HTTPCookieStringPolicy.sameSiteStrict,
            ])!
            configuration.websiteDataStore.httpCookieStore.setCookie(cookie) { self.show(configuration, origin: origin) }
        }
    }

    private func show(_ configuration: WKWebViewConfiguration, origin: String) {
        let web = WKWebView(frame: .zero, configuration: configuration)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.isOpaque = false
        web.backgroundColor = view.backgroundColor
        web.scrollView.backgroundColor = view.backgroundColor
        web.scrollView.contentInsetAdjustmentBehavior = .never
        #if DEBUG
        if #available(iOS 16.4, *) { web.isInspectable = true }
        #endif
        web.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(web)
        NSLayoutConstraint.activate([
            web.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
            web.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            web.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor),
        ])
        status.isHidden = true
        webView = web
        web.load(URLRequest(url: URL(string: origin + "/")!))
    }

    private func isWorkspace(_ url: URL) -> Bool {
        guard let origin, let scheme = url.scheme, let host = url.host, let port = url.port else { return false }
        return "\(scheme)://\(host):\(port)" == origin
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { return decisionHandler(.cancel) }
        // Embedded frames (sandboxed HTML views, videos) load in place; loopback ones are blocked by the content rules.
        if isWorkspace(url) || action.targetFrame?.isMainFrame == false { return decisionHandler(.allow) }
        if action.navigationType == .linkActivated && url.scheme == "https" { UIApplication.shared.open(url) }
        decisionHandler(.cancel)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url, url.scheme == "https" { UIApplication.shared.open(url) }
        return nil
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()
    }
}
