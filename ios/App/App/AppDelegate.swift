import UIKit
import Capacitor
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Force the window + root host view + the WKWebView background to white
        // so iPad never shows a black flash during the remote-URL bootstrap.
        // (App Store Review rejected the build on iPad Air M3 / iPadOS 26.4.2
        // because the WebView's empty state painted black before first content.)
        if let window = self.window {
            window.backgroundColor = .white
            window.rootViewController?.view.backgroundColor = .white
        }
        DispatchQueue.main.async { [weak self] in
            self?.applyWhiteBackgroundsRecursively()
        }
        return true
    }

    /// Walk the view hierarchy a couple of times and force every WKWebView to
    /// be white. The view tree isn't fully built at didFinishLaunching, so we
    /// also re-apply when the app becomes active.
    private func applyWhiteBackgroundsRecursively() {
        guard let root = window?.rootViewController?.view else { return }
        root.backgroundColor = .white
        func walk(_ v: UIView) {
            v.backgroundColor = .white
            if let web = v as? WKWebView {
                web.isOpaque = true
                web.backgroundColor = .white
                web.scrollView.backgroundColor = .white
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
        // Re-apply white backgrounds once the view tree is guaranteed to be live.
        applyWhiteBackgroundsRecursively()
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
