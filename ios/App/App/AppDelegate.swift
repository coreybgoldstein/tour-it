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

    // Timestamp of the most recent applicationDidEnterBackground — only
    // set when the app is truly off-screen, NOT for shallow interruptions
    // like Control Center peeks, Face ID prompts, or notification banners
    // (those fire applicationWillResignActive but not didEnterBackground).
    // Compared against applicationDidBecomeActive to decide whether the
    // gap was long enough to warrant a WebView reload.
    private var enteredBackgroundAt: Date?

    // Timestamp of the most recent WebView reload. Used as a cooldown to
    // prevent recovery from compounding when the user takes several
    // screenshots in a row OR the app is interrupted multiple times in
    // quick succession.
    private var lastRecoveryAt: Date?

    // Recovery thresholds, tuned with the ChatGPT/Gemini reviews in mind.
    // 1.5s "real backgrounding" is the sweet spot — short enough to catch
    // every iOS lifecycle that corrupts the WebView, long enough to skip
    // tap-then-back interactions. 3s cooldown means rapid retriggers don't
    // pile up reloads.
    private let backgroundedThreshold: TimeInterval = 1.5
    private let minRecoveryInterval: TimeInterval = 3.0

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
                self?.recoverWebViews(reason: "screenshot")
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

    /// Walk the view hierarchy and recover every WKWebView. Two-step:
    ///   1. stopLoading() — tears down stuck in-flight requests that
    ///      otherwise compete with the reload for the URLSession slot.
    ///   2. reloadFromOrigin() — bypasses the local cache and fetches HTML
    ///      fresh from the network, creating a new URLSession-backed
    ///      navigation. This is the layer iOS suspend corrupts and the
    ///      layer JS-side window.location.reload() can't recover because
    ///      it reuses the same session.
    /// Honors a cooldown so rapid retriggers (multiple screenshots, multi-
    /// step interruption) don't compound.
    private func recoverWebViews(reason: String) {
        if let last = lastRecoveryAt,
           Date().timeIntervalSince(last) < minRecoveryInterval {
            NSLog("[TourIt] recovery skipped (cooldown) reason=\(reason)")
            return
        }
        lastRecoveryAt = Date()
        NSLog("[TourIt] recoverWebViews reason=\(reason)")
        guard let root = window?.rootViewController?.view else { return }
        func walk(_ v: UIView) {
            if let web = v as? WKWebView {
                web.stopLoading()
                web.reloadFromOrigin()
            }
            v.subviews.forEach(walk)
        }
        walk(root)
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Intentionally empty — resignActive fires for shallow interrupts
        // (Control Center peek, Face ID prompt, brief banner) that don't
        // corrupt the WebView. We only want to recover when the app was
        // truly backgrounded; that's tracked in applicationDidEnterBackground.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        enteredBackgroundAt = Date()
    }

    func applicationWillEnterForeground(_ application: UIApplication) { }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Re-apply brand backgrounds once the view tree is guaranteed to be live.
        applyBrandBackgroundsRecursively()

        // Only recover if the app was truly backgrounded (didEnterBackground
        // fired) AND for longer than the threshold. Shallow resignActive
        // interruptions (notification shade, Face ID, control center) are
        // skipped because they don't corrupt the WebView's network stack
        // and reloading on every one would wipe in-progress UI state.
        guard let backgroundedAt = enteredBackgroundAt else { return }
        let awayMs = Date().timeIntervalSince(backgroundedAt) * 1000
        enteredBackgroundAt = nil
        if awayMs >= backgroundedThreshold * 1000 {
            NSLog("[TourIt] background gap %.0fms — triggering recovery", awayMs)
            recoverWebViews(reason: "didBecomeActive")
        } else {
            NSLog("[TourIt] background gap %.0fms — below threshold, skipping recovery", awayMs)
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
