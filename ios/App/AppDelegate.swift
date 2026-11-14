import UIKit

// The game is one web page, shown full screen, like the Android app: everything it needs is inside the app.
@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(_ application: UIApplication, configurationForConnecting session: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
    let config = UISceneConfiguration(name: "Game", sessionRole: session.role)
    config.delegateClass = SceneDelegate.self
    return config
  }
}

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options: UIScene.ConnectionOptions) {
    guard let scene = scene as? UIWindowScene else { return }
    let window = UIWindow(windowScene: scene)
    window.backgroundColor = GameViewController.night
    window.rootViewController = GameViewController()
    window.makeKeyAndVisible()
    self.window = window
  }

  // the screen stays on through a flight, as on Android
  func sceneDidBecomeActive(_ scene: UIScene) {
    UIApplication.shared.isIdleTimerDisabled = true
  }

  func sceneWillResignActive(_ scene: UIScene) {
    UIApplication.shared.isIdleTimerDisabled = false
  }
}
