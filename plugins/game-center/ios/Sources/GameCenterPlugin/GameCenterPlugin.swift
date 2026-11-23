import Foundation
import Capacitor
import GameKit

/// Game Center for ONE MORE ORBIT: sign-in, score submission, achievements and the dashboard.
/// Leaderboard and achievement IDs are made in src/native.ts and must exist in App Store Connect.
@objc(GameCenterPlugin)
public class GameCenterPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GameCenterPlugin"
    public let jsName = "GameCenter"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "submitScore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reportAchievement", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise)
    ]

    @objc public func signIn(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let player = GKLocalPlayer.local
            if player.isAuthenticated {
                call.resolve(["authenticated": true, "alias": player.alias])
                return
            }
            var answered = false
            // GameKit calls this again whenever the sign-in state changes; only the first outcome answers the call.
            player.authenticateHandler = { [weak self] viewController, error in
                if let sheet = viewController {
                    self?.bridge?.viewController?.present(sheet, animated: true)
                    return
                }
                if answered { return }
                answered = true
                if player.isAuthenticated {
                    call.resolve(["authenticated": true, "alias": player.alias])
                } else {
                    call.resolve(["authenticated": false, "reason": error?.localizedDescription ?? "not signed in"])
                }
            }
        }
    }

    @objc public func submitScore(_ call: CAPPluginCall) {
        guard let board = call.getString("leaderboardId"), let score = call.getInt("score") else {
            call.reject("leaderboardId and score are required")
            return
        }
        guard GKLocalPlayer.local.isAuthenticated else {
            call.resolve(["sent": false])
            return
        }
        GKLeaderboard.submitScore(score, context: 0, player: GKLocalPlayer.local, leaderboardIDs: [board]) { error in
            if let error = error {
                call.reject(error.localizedDescription)
            } else {
                call.resolve(["sent": true])
            }
        }
    }

    @objc public func reportAchievement(_ call: CAPPluginCall) {
        guard let id = call.getString("achievementId") else {
            call.reject("achievementId is required")
            return
        }
        guard GKLocalPlayer.local.isAuthenticated else {
            call.resolve(["sent": false])
            return
        }
        let achievement = GKAchievement(identifier: id)
        achievement.percentComplete = min(100, max(0, call.getDouble("percent") ?? 100))
        achievement.showsCompletionBanner = true
        GKAchievement.report([achievement]) { error in
            if let error = error {
                call.reject(error.localizedDescription)
            } else {
                call.resolve(["sent": true])
            }
        }
    }

    @objc public func show(_ call: CAPPluginCall) {
        let state: GKGameCenterViewControllerState = call.getString("view") == "achievements" ? .achievements : .leaderboards
        DispatchQueue.main.async {
            GKAccessPoint.shared.trigger(state: state) { }
            call.resolve()
        }
    }
}
