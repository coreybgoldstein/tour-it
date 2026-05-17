import UIKit
import Capacitor
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    // Tour It brand dark — matches body{background:#07100a} in globals.css so
    // there's no contrast between native chrome and the WebView's first paint.
    // Was white for the iPad App Store Review fix on 2026-05-12, but that
    // caused visible white flashes on every route change. Dark matches the app.
    private static let brandDark: UIColor = UIColor(red: 7/255, green: 16/255, blue: 10/255, alpha: 1)

    // Timestamp of the most recent applicationWillResignActive. Compared
    // against applicationDidBecomeActive to decide whether to reload the
    // WebView — sub-millisecond focus blips (Control Center peek, brief
    // banner) are skipped; anything longer reloads to clear post-suspend
    // corruption that JS-level lifecycle hooks don't catch.
    private var resignedActiveAt: Date?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        if let window = self.window {
            window.backgroundColor = AppDelegate.brandDark
            window.rootViewController?.view.backgroundColor = AppDelegate.brandDark
        }
        DispatchQueue.main.async { [weak self] in
            self?.applyBrandBackgroundsRecursively()
        }

        // iOS screenshot capture leaves the WebView in a state where the
        // content area renders blank on return while the BottomNav layout
        // stays alive. visibilitychange / blur / focus do NOT reliably fire
        // for screenshots in WKWebView, so the JS-side recovery in
        // NativeBootstrap.tsx can't catch this case. Recover natively:
        // listen for the screenshot notification and reload the WebView.
        NotificationCenter.default.addObserver(
            forName: UIApplication.userDidTakeScreenshotNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            // Let iOS finish its snapshot capture before we yank the view.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                self?.reloadAllWebViewsFromOrigin()
            }
        }

        return true
    }

    /// Walk the view hierarchy and force every WKWebView's background to the
    /// brand dark color so route changes never expose a white flash. Re-applies
    /// on every applicationDidBecomeActive since the WebView's host can reset
    /// its scroll view background after navigation.
    private func applyBrandBackgroundsRecursively() {
        guard let root = window?.rootViewController?.view else { return }
        root.backgroundColor = AppDelegate.brandDark
        func walk(_ v: UIView) {
            v.backgroundColor = AppDelegate.brandDark
            if let web = v as? WKWebView {
                web.isOpaque = true
                web.backgroundColor = AppDelegate.brandDark
                web.scrollView.backgroundColor = AppDelegate.brandDark
                // Kill the WKWebView's scroll-past-top rubber-band so the
                // app feels native. Real iOS apps don't let you stretch the
                // first screen above its top edge — without this, every
                // page reads as "this is a website inside a shell."
                web.scrollView.bounces = false
                web.scrollView.alwaysBounceVertical = false
                web.scrollView.alwaysBounceHorizontal = false
            }
            v.subviews.forEach(walk)
        }
        walk(root)
    }

    /// Walk the view hierarchy and reload every WKWebView from origin. Unlike
    /// `webView.reload()` (which keeps the cache + URLSession), this
    /// bypasses the local cache and tears down stuck in-flight requests in
    /// the WebView's URLSession. That URLSession is the layer iOS suspend
    /// corrupts, and the layer JS-side `window.location.reload()` can't
    /// recover because it reuses the same session.
    private func reloadAllWebViewsFromOrigin() {
        guard let root = window?.rootViewController?.view else { return }
        func walk(_ v: UIView) {
            if let web = v as? WKWebView {
                web.reloadFromOrigin()
            }
            v.subviews.forEach(walk)
        }
        walk(root)
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Mark when we lost active state so applicationDidBecomeActive can
        // decide whether the gap was long enough to warrant a reload.
        resignedActiveAt = Date()
    }

    func applicationDidEnterBackground(_ application: UIApplication) { }

    func applicationWillEnterForeground(_ application: UIApplication) { }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Re-apply brand backgrounds once the view tree is guaranteed to be live.
        applyBrandBackgroundsRecursively()

        // If the app was inactive for > 500ms, the WebView's URLSession +
        // render state may be corrupted (the bug where content goes blank
        // on resume while BottomNav stays alive). Reload from origin to
        // recover. 500ms threshold skips trivial focus blips like a
        // Control Center peek so users don't lose state on every glance.
        if let resignedAt = resignedActiveAt {
            let awayMs = Date().timeIntervalSince(resignedAt) * 1000
            resignedActiveAt = nil
            if awayMs > 500 {
                reloadAllWebViewsFromOrigin()
            }
        }
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
