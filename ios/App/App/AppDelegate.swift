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

    // Recovery thresholds. 60s is intentionally conservative — only triggers
    // recovery after the app's been backgrounded long enough that iOS may
    // actually have suspended the WebView's URLSession. Brief context
    // switches (open Messages, glance at a notification, take a screenshot)
    // fall under this floor and pass through with no reload, preserving UI
    // state. We also probe the WebView before reloading; if JS responds,
    // the WebView is alive and we skip the reload entirely.
    //
    // History: an earlier 1.5s threshold caused a visible reload on every
    // brief app switch — false-positive recovery was worse than the
    // original blank-screen bug it was solving.
    private let backgroundedThreshold: TimeInterval = 60.0
    private let minRecoveryInterval: TimeInterval = 3.0
    private let probeTimeout: TimeInterval = 0.5

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        if let window = self.window {
            window.backgroundColor = AppDelegate.brandDark
            window.rootViewController?.view.backgroundColor = AppDelegate.brandDark
        }
        DispatchQueue.main.async { [weak self] in
            self?.applyBrandBackgroundsRecursively()
        }

        // Re-register the screenshot listener. The previous version pulled it
        // out because the recovery (a full reload) was destroying in-memory
        // UI state on every screenshot. The new path calls nudgeRender(),
        // which forces a GPU layer recomposite without reloading — so users
        // can screenshot all day without losing state OR seeing a black
        // WebView. See nudgeRender() doc comment for the mechanism.
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleScreenshot),
            name: UIApplication.userDidTakeScreenshotNotification,
            object: nil
        )

        return true
    }

    @objc private func handleScreenshot() {
        nudgeRender(reason: "screenshot")
    }

    /// Force a GPU layer recomposite on the live WebView without reloading.
    ///
    /// The bug this addresses: WKWebView's compositor can hiccup after iOS
    /// captures the screen (screenshot, app-switcher snapshot, brief
    /// backgrounding). JS keeps running — so any JS-execution probe falsely
    /// reports the WebView healthy — but the visible CALayer goes black.
    /// reloadFromOrigin() fixes it but obliterates in-memory state, which
    /// is worse than the bug.
    ///
    /// The trick: append " translateZ(0)" to body.style.transform, force a
    /// layout, then restore the original next frame. translateZ(0) is the
    /// standard GPU-promote hint; appending it bumps body into its own
    /// composite layer momentarily, which clears render-pipeline glitches.
    /// Visually a no-op (the transform is restored before any frame paints
    /// the modified value). State-preserving and cheap.
    ///
    /// Safe to fire-and-forget: if JS is genuinely dead (which is what the
    /// probe+reload path catches), the eval just no-ops; no completion
    /// handler is registered.
    private func nudgeRender(reason: String) {
        guard let web = findFirstWebView() else { return }
        NSLog("[TourIt] nudgeRender reason=\(reason)")
        let js = """
        (function() {
          var b = document.body;
          if (!b) return;
          var prev = b.style.transform || '';
          b.style.transform = prev + ' translateZ(0)';
          // Force a synchronous reflow so the compositor reads the new layer.
          void b.offsetHeight;
          requestAnimationFrame(function() { b.style.transform = prev; });
        })();
        """
        web.evaluateJavaScript(js, completionHandler: nil)
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
    /// Honors a cooldown so rapid retriggers don't compound.
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

    /// Find the first WKWebView in the view hierarchy. Used by the probe
    /// path — we only need to test one because iOS suspends them
    /// collectively; if one is alive, they all are.
    private func findFirstWebView() -> WKWebView? {
        guard let root = window?.rootViewController?.view else { return nil }
        var found: WKWebView?
        func walk(_ v: UIView) {
            if found != nil { return }
            if let w = v as? WKWebView { found = w; return }
            v.subviews.forEach(walk)
        }
        walk(root)
        return found
    }

    /// Liveness check before reload. Evaluates a trivial JS expression in
    /// the WebView; if it returns within probeTimeout the WebView is alive
    /// and we skip the reload entirely. Only if the probe fails or times
    /// out do we fall through to recoverWebViews.
    ///
    /// This is the layer that prevents the over-eager-reload UX bug: a
    /// long backgrounding that DIDN'T actually break the WebView no
    /// longer wipes the user's in-memory state on return.
    private func probeAndRecoverIfNeeded(reason: String) {
        guard let web = findFirstWebView() else {
            NSLog("[TourIt] probe skipped — no WKWebView found reason=\(reason)")
            return
        }

        // Resolved guard: the JS callback and the timeout race each other;
        // whichever fires first wins, the other is a no-op.
        var resolved = false
        let resolve: (Bool) -> Void = { [weak self] alive in
            if resolved { return }
            resolved = true
            if alive {
                NSLog("[TourIt] probe ok — WebView alive, skip reload reason=\(reason)")
            } else {
                NSLog("[TourIt] probe failed — reload reason=\(reason)")
                self?.recoverWebViews(reason: reason)
            }
        }

        web.evaluateJavaScript("1") { result, error in
            resolve(error == nil && result != nil)
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + probeTimeout) {
            resolve(false)
        }
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

        // ALWAYS nudge the compositor on resume. Cheap, state-preserving,
        // and fixes the "JS alive but visually black" rendering hiccup that
        // iOS produces on brief backgroundings — the case the 60s probe
        // threshold deliberately misses to avoid over-eager reloads.
        nudgeRender(reason: "didBecomeActive")

        // Then, for the long-suspend case (>60s), separately probe + reload
        // if the WebView's URLSession actually went zombie. State loss is
        // acceptable here because the alternative is a permanently-broken
        // app the user has to force-quit.
        guard let backgroundedAt = enteredBackgroundAt else { return }
        let awayMs = Date().timeIntervalSince(backgroundedAt) * 1000
        enteredBackgroundAt = nil
        if awayMs >= backgroundedThreshold * 1000 {
            NSLog("[TourIt] background gap %.0fms — probing WebView", awayMs)
            probeAndRecoverIfNeeded(reason: "didBecomeActive")
        } else {
            NSLog("[TourIt] background gap %.0fms — below threshold, skipping probe", awayMs)
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
