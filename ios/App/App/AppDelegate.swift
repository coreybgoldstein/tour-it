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

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        if let window = self.window {
            window.backgroundColor = AppDelegate.brandDark
            window.rootViewController?.view.backgroundColor = AppDelegate.brandDark
        }
        DispatchQueue.main.async { [weak self] in
            self?.applyBrandBackgroundsRecursively()
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

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Re-apply brand backgrounds once the view tree is guaranteed to be live.
        applyBrandBackgroundsRecursively()
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
