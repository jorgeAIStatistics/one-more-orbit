# Release checklist: what only you can do

Everything below needs your accounts, your money or your devices. Nothing here has been done for you. The project side is ready: see "What is already prepared" at the end.

## 0. Before anything is public: the music licence

- [x] **NCS game licence:** you confirmed on 23 November 2026 that you hold it. Settings → About now reads "Music used under a game licence from NoCopyrightSounds". Keep the licence document at hand: App Review can ask for it.
- A track is swapped by replacing its entry in `levels/manifest.json` and `src/game/packs.ts` (see `tools/README.md` for cutting and charting a new song).

## 1. Test on your iPhone (free, 15 minutes)

- [ ] On the Mac: `npm run phone`. Open the `Network:` address in Safari on the iPhone (same Wi-Fi).
- [ ] Sound starts on the first tap, including with the ring/silent switch set to silent.
- [ ] Run the sync check with the speaker, then with your usual headphones. Play level 1: do the taps feel on the beat? What does the results screen say (early/late)?
- [ ] Smooth at 60 fps through a drop on levels 1 and 4.
- [ ] Take a call or switch apps mid-level: the game is paused when you come back, and sound returns on Resume.
- [ ] Close Safari, reopen: bests, attempts and settings are still there.
- [ ] Every screen in portrait and landscape; nothing under the notch or the home bar.
- [ ] Title tap goes to the level select and does not start a level by itself.

Over `npm run phone` the site is plain HTTP, so "works offline" and "Add to Home Screen as an app" can only be tested on the live GitHub Pages address.

## 2. Website on GitHub Pages (done on 23 November 2026)

- [x] Public repository: https://github.com/jorgeAIStatistics/one-more-orbit (`main` and the tags). The source and the four music excerpts are public.
- [x] Pages is set to GitHub Actions, the same way as your HistoQuest site. Every push to `main` tests, builds and deploys.
- [x] Live address: **https://jorgeaistatistics.github.io/one-more-orbit/**
- [x] Checked in Chrome at phone size: the page, manifest, icons, music, privacy and support pages load; the game opens with no connection after the first visit; the first tap starts the sound.
- [ ] Still yours, on the iPhone: open it in Safari, Share → Add to Home Screen, switch on airplane mode and start it. Send the link to yourself in iMessage and WhatsApp and check the preview card.

## 3. Apple Developer Program (costs money)

- [ ] Enrol at developer.apple.com/programs: **US$99 per year**, with your Apple Account (two-factor on). Approval can take a day or two.
- [ ] Accept the agreements in App Store Connect (Business section). A free app needs no bank or tax forms.

## 4. Xcode (free, large download)

This Mac has only the Command Line Tools, so the iOS project has never been compiled. Expect to fix small things on the first build.

- [ ] Install **Xcode 26 or later** from the Mac App Store (Apple requires Xcode 26 with the iOS 26 SDK for uploads; from April 2027, Xcode 27).
- [ ] Xcode → Settings → Accounts: sign in with your Apple Account.
- [ ] In the project folder: `npm run ios:sync`, then `npm run ios:open`.
- [ ] Target **App** → Signing & Capabilities: tick "Automatically manage signing" and choose your team. Xcode creates the certificates and provisioning profile. Check that **Game Center** is listed as a capability (the entitlement file is already there); add it with "+ Capability" if not.
- [ ] The bundle ID is `com.jorgeaistatistics.onemoreorbit`. To change it, edit `appId` in `capacitor.config.ts` and the two `PRODUCT_BUNDLE_IDENTIFIER` lines in Xcode before you register anything.
- [ ] Plug in the iPhone, pick it as the destination, press Run. Check: launch screen, no status bar over the game, sound with the silent switch on, haptics on taps and on the drop (Settings → Haptics switches them off), Game Center banner on launch, Ranks on the level select, pause when you leave the app, the label under the icon not cut short.
- [ ] If the build stops in `GameCenterPlugin.swift` or `AppDelegate.swift`, send me the error: that code was written without a compiler.

## 5. App Store Connect

- [ ] My Apps → "+" → New App: iOS, name (see the name check in `release/app-store-listing.md`), primary language, bundle ID, SKU (any, for example `onemoreorbit`).
- [ ] Fill in the listing from `release/app-store-listing.md`: subtitle, description, keywords, categories, URLs, age rating answers, privacy label, review notes.
- [ ] Upload the screenshots from `release/screenshots/` (both sizes).
- [ ] Game Center: create the 8 leaderboards and 10 achievements from the tables in the listing file (images in `release/achievements/`), add them to the app version, tick Game Center on the version.

## 6. TestFlight

- [ ] In Xcode: destination "Any iOS Device", Product → Archive, then Distribute App → App Store Connect → Upload.
- [ ] Wait for processing (10 to 30 minutes). Internal testers (up to 100 people on your team) can install at once.
- [ ] For friends: TestFlight → External Testing → create a group, add the build, fill in "What to test", submit for Beta App Review (usually about a day for the first build). Then invite by email or turn on a public link. Up to 10,000 testers; each build lasts 90 days.
- [ ] Friends install the TestFlight app and open your link.

## 7. Submission

- [ ] Pick the build on the version page, attach the Game Center items, answer the export question if asked (no encryption beyond the system's), set "Manually release" if you want to choose the day.
- [ ] Submit for review. Have the NCS licence ready to attach if they ask about the music.
- [ ] If App Review cites 4.2 (minimum functionality), reply with the list in the listing file under "Guideline 4.2".

## What is already prepared

- Website build with web-app manifest, icons, iPhone launch images, offline cache, share preview, privacy and support pages, and the Pages workflow.
- iOS project in `ios/` (Capacitor 8, Swift packages, iPhone only, iOS 15+): icon, launch image, Game Center entitlement, audio session, full screen, export-compliance key. All game files are copied into the app by `npm run ios:sync`; nothing is loaded from the web.
- Game Center code (`plugins/game-center/`, `src/native.ts`): sign-in at launch, best percent and flow per level, one achievement per badge, the dashboard from the level select and Settings.
- Haptics with a switch in Settings; pause and save when the app leaves the screen.
- Store listing text, screenshots at both required sizes, the 1024 icon, achievement images.
