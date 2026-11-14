import UIKit
import WebKit
import os

// Shows www/index.html from the app's own files. The page is served at app://game/ rather than file://, so it has one
// fixed origin and its localStorage saves stay between launches. The page talks to the phone through
// window.PizzaScreen, the same bridge the Android app gives it: sideways(on) and buzz(ms).
final class GameViewController: UIViewController, WKScriptMessageHandler, WKURLSchemeHandler {
  static let night = UIColor(red: 0x1a / 255, green: 0x14 / 255, blue: 0x30 / 255, alpha: 1)
  private static let scheme = "app"
  private static let page = URL(string: "app://game/index.html")!
  private static let files = Bundle.main.resourceURL!.appendingPathComponent("www", isDirectory: true).standardizedFileURL

  private static let bridge = """
  (() => {
    const post = (k, v) => window.webkit.messageHandlers.pizza.postMessage({ k, v });
    window.PizzaScreen = { sideways: on => post('sideways', !!on), buzz: ms => post('buzz', +ms || 0) };
  })();
  """

  // Debug builds only: the page's errors and a few facts about it reach the system log, where the simulator run reads them.
  private static let report = """
  (() => {
    const text = x => { try { return x instanceof Error ? (x.stack || String(x)) : typeof x === 'object' ? JSON.stringify(x) : String(x); } catch (_) { return String(x); } };
    const say = (...a) => { try { window.webkit.messageHandlers.pizza.postMessage({ k: 'log', v: a.map(text).join(' ') }); } catch (_) {} };
    for (const level of ['error', 'warn']) { const was = console[level]; console[level] = (...a) => { say(level, ...a); was.apply(console, a); }; }
    addEventListener('error', e => say('error', e.message, `${e.filename}:${e.lineno}`));
    addEventListener('unhandledrejection', e => say('rejection', e.reason));
    addEventListener('load', () => setTimeout(() => {
      let kept = 'none', saves = 'ok';
      try { kept = localStorage.getItem('iosProbe') ?? 'none'; localStorage.setItem('iosProbe', String(Date.now())); } catch (e) { saves = String(e); }
      say('ready', `${innerWidth}x${innerHeight}`, 'dpr', devicePixelRatio, 'lalezar', document.fonts.check('20px Lalezar'),
        'tajawal', document.fonts.check('700 20px Tajawal'), 'saves', saves, 'kept', kept, 'bridge', !!window.PizzaScreen);
    }, 3000));
  })();
  """

  private let log = Logger(subsystem: "com.flyingparcel.game", category: "page")
  private var web: WKWebView!
  private var sideways = false

  override func loadView() {
    let config = WKWebViewConfiguration()
    config.setURLSchemeHandler(self, forURLScheme: Self.scheme)
    // the game's sounds start without waiting for a tap, as in the Android app
    config.mediaTypesRequiringUserActionForPlayback = []
    config.allowsInlineMediaPlayback = true
    let content = config.userContentController
    content.addUserScript(WKUserScript(source: Self.bridge, injectionTime: .atDocumentStart, forMainFrameOnly: true))
    #if DEBUG
    content.addUserScript(WKUserScript(source: Self.report, injectionTime: .atDocumentStart, forMainFrameOnly: true))
    #endif
    content.add(WeakHandler(self), name: "pizza")

    web = WKWebView(frame: .zero, configuration: config)
    web.isOpaque = false
    web.backgroundColor = Self.night
    web.scrollView.backgroundColor = Self.night
    // the page places itself around the notch with env(safe-area-inset-*)
    web.scrollView.contentInsetAdjustmentBehavior = .never
    web.scrollView.bounces = false
    web.scrollView.showsVerticalScrollIndicator = false
    web.scrollView.showsHorizontalScrollIndicator = false
    web.allowsLinkPreview = false
    web.allowsBackForwardNavigationGestures = false
    #if DEBUG
    if #available(iOS 16.4, *) { web.isInspectable = true }
    #endif
    view = web
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    web.load(URLRequest(url: Self.page))
  }

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    #if DEBUG
    // the simulator run starts the app with -ForceSideways YES to see the wide screen
    if UserDefaults.standard.bool(forKey: "ForceSideways") { setSideways(true) }
    #endif
  }

  override var prefersStatusBarHidden: Bool { true }
  override var prefersHomeIndicatorAutoHidden: Bool { true }
  // a swipe from an edge during a flight asks twice before it leaves the game
  override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { .all }
  override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
    if sideways { return .landscape }
    return traitCollection.userInterfaceIdiom == .pad ? .all : .allButUpsideDown
  }

  // MARK: the bridge

  func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
    guard let body = message.body as? [String: Any], let kind = body["k"] as? String else { return }
    switch kind {
    case "sideways": setSideways((body["v"] as? Bool) ?? false)
    case "buzz": buzz((body["v"] as? NSNumber)?.doubleValue ?? 0)
    #if DEBUG
    case "log": log.notice("page: \(String(describing: body["v"] ?? ""), privacy: .public)")
    #endif
    default: break
    }
  }

  // Sideways locks the game to the phone's side; off follows the phone again, as Android's fullUser does.
  private func setSideways(_ on: Bool) {
    sideways = on
    #if DEBUG
    log.notice("sideways \(on, privacy: .public)")
    #endif
    setNeedsUpdateOfSupportedInterfaceOrientations()
    guard on, let scene = view.window?.windowScene else { return }
    scene.requestGeometryUpdate(.iOS(interfaceOrientations: .landscape)) { [weak self] error in
      self?.log.error("turn failed: \(error.localizedDescription, privacy: .public)")
    }
  }

  // The page asks in milliseconds (12 to 90); an iPhone taps rather than buzzes, so the length picks how firm the tap is.
  private func buzz(_ ms: Double) {
    let style: UIImpactFeedbackGenerator.FeedbackStyle = ms <= 20 ? .light : ms <= 45 ? .medium : .heavy
    UIImpactFeedbackGenerator(style: style).impactOccurred()
  }

  // MARK: app://game/ serves the files in www/

  func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
    guard let url = task.request.url else { return }
    let path = url.path.isEmpty || url.path == "/" ? "index.html" : String(url.path.dropFirst())
    let file = Self.files.appendingPathComponent(path).standardizedFileURL
    guard file.path.hasPrefix(Self.files.path + "/"), let data = try? Data(contentsOf: file) else {
      task.didReceive(HTTPURLResponse(url: url, statusCode: 404, httpVersion: "HTTP/1.1", headerFields: nil)!)
      task.didFinish()
      return
    }
    let type: String
    switch file.pathExtension.lowercased() {
    case "html": type = "text/html; charset=utf-8"
    case "js": type = "text/javascript; charset=utf-8"
    case "css": type = "text/css; charset=utf-8"
    case "png": type = "image/png"
    case "woff2": type = "font/woff2"
    default: type = "text/plain; charset=utf-8"
    }
    let head = ["Content-Type": type, "Content-Length": String(data.count), "Cache-Control": "no-cache"]
    task.didReceive(HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: head)!)
    task.didReceive(data)
    task.didFinish()
  }

  func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}

// The page's message handler is held weakly, so the view controller and its web view can let each other go.
private final class WeakHandler: NSObject, WKScriptMessageHandler {
  weak var target: WKScriptMessageHandler?
  init(_ target: WKScriptMessageHandler) { self.target = target }
  func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
    target?.userContentController(controller, didReceive: message)
  }
}
