# App Store listing: ONE MORE ORBIT

Everything to paste into App Store Connect. Limits checked against Apple's pages on 23 November 2026.

## Name

- **First choice:** `One More Orbit` (14 of 30 characters).
- **Name check:** the US App Store already has "One More Orbit: Reflex Test" (by Cheolsu Kim, a game). App names must be unique, and App Store Connect only tells you when you create the app record. The plain name may be accepted because the other one has a suffix; it may also be refused, or challenged later as confusingly similar.
- **Fallbacks:** `One More Orbit: Rhythm Hop` (26), `One More Orbit – Beat Hop` (25).
- Home-screen label (`CFBundleDisplayName`): `One More Orbit`. Check on the phone that it is not cut short; if it is, use `More Orbit`.

## Subtitle (30 max)

`Tap the beat. Charge the drop.` (30)

Alternative: `One-button rhythm in orbit` (26)

## Promotional text (170 max)

Four levels, one button. Hop from ring to ring on the beat, keep your flow and charge the drop. Now with Game Center leaderboards for every level.

## Description (4000 max)

ONE MORE ORBIT is a rhythm game you play with one finger.

A ball rides a ring in time with the music. Tap as it crosses each white mark and it hops to the next ring. Tap the gold notes and you build flow. Reach the build-up in flow, charge it, and the drop goes off as big as you made it.

ONE BUTTON, FOUR WAYS TO PLAY
• Heroes Tonight (Easy): slingshot from planet to planet.
• Sky High (Normal): flip gravity and weave between two rings.
• Blank (Hard): thread the gaps in spinning gates.
• Invincible (Insane): one tap moves two mirrored balls at once.

FAIR, NOT FRUSTRATING
• The presses that can end a run sit on the strong beats, with generous timing.
• Every faster note is optional. Gold notes can never end your run.
• Nothing can go wrong in the build-up. It is there to charge the drop.
• A crash restarts in half a second. Practice restarts from the section you reached.

IN SYNC WITH YOUR PHONE
• A 10-second sync check lines the game up with your speakers or headphones.
• The game shows whether your taps run early or late, and fixes it with one tap.

MORE
• Game Center leaderboards for best percent and flow on every level.
• Ten achievements and seven ball colours to earn.
• Haptics you can switch off, and a reduced-motion option.
• No ads. No accounts. No data collected. Works offline.

Music: Heroes Tonight (feat. Johnning) – Janji, Sky High – Elektronomia, Blank – Disfigure, Invincible – DEAF KEV. Music provided by NoCopyrightSounds.

## Keywords (100 bytes max; this is 97)

`rhythm,music,beat,tap,one button,arcade,edm,reflex,timing,dash,hop,ring,drop,flow,sync,electronic`

## Categories

- Primary: **Games**, subcategories **Music** and **Arcade** (or Casual).
- Secondary: none needed.

## Age rating

Answer **None / No** to every item in the questionnaire (in-app controls, capabilities, mature themes, medical, sexuality, violence, chance-based activities). There is no web access, chat, user content, advertising, or purchases. Expected result: **4+**. Do not tick "Made for Kids" (it is permanent and adds rules).

## App privacy

- Privacy label: **"No, we do not collect data from this app."**
- Privacy Policy URL: `https://jorgeaistatistics.github.io/one-more-orbit/privacy.html`
- Support URL: `https://jorgeaistatistics.github.io/one-more-orbit/support.html`
- Marketing URL (optional): `https://jorgeaistatistics.github.io/one-more-orbit/`
- Game Center: Apple's page says you are not responsible for disclosing data Apple collects through its own services, and scores go straight to Game Center, not to a server of yours. Apple does not say this about Game Center by name, so this is a reading, not a quote. The game uses no custom nickname prompt and no "submit your score" wording, which is what has drawn questions in review.

## Export compliance

The app uses no encryption of its own. `ITSAppUsesNonExemptEncryption` is set to `false` in Info.plist, so App Store Connect will not ask on each upload.

## Price and availability

Free, no in-app purchases. Countries: your choice (all is fine).

## Screenshots

In `release/screenshots/`, portrait JPEG:

| Folder | Size | Apple's class |
|---|---|---|
| `iphone-large-1290x2796/` | 1290 × 2796 | iPhone with Dynamic Island, large display |
| `iphone-medium-1206x2622/` | 1206 × 2622 | iPhone with Dynamic Island, medium display |

Seven shots each (1 to 10 allowed): level select, the drop, twin orbit, level complete, results, badges, title. Upload both sizes; Apple's page calls the medium size required and the large size the fallback for other large iPhones.

- The app is iPhone-only, so no iPad screenshots are needed.
- **iPhone Duo:** Apple will require iPhone Duo screenshots (1398 × 2034 and 2007 × 2853) from April 2027. Not needed for a submission before then.
- To retake them: `npm run dev`, then `node tools/store-shots.mjs` (needs `npm i -D playwright-core` and Google Chrome).
- These are captured from the game running in Chrome at the exact pixel sizes, not on an iPhone. Check them against the real app before uploading.

## App icon

`release/app-icon-1024.png` (1024 × 1024, no transparency). It is already in the Xcode project.

## Notes for App Review

> ONE MORE ORBIT is a one-button rhythm game with four levels. No account or login is needed. Game Center is optional: the game is fully playable signed out. Tap anywhere to play; the first launch runs a 10-second sync check (it can be skipped) and a short tutorial. Settings has "All levels open" if you want to see every level without clearing the earlier ones. The music is by NoCopyrightSounds artists and is used under a game licence from NoCopyrightSounds (licence attached).

The last sentence is only true once you hold the NCS game licence: get it first, then attach it. Review can ask for proof of music rights (guideline 5.2).

## Guideline 4.2 (minimum functionality): what makes this an app

Bundled, offline, native features beyond a web page: Game Center leaderboards (8) and achievements (10), haptics, game audio that plays with the ring/silent switch on silent, pausing when the app leaves the screen, safe-area layouts, launch screen and icon.

## Game Center setup

Create these in App Store Connect (your app → Game Center). IDs must match exactly; they are built in `src/native.ts`.

### Leaderboards (classic, "Best Score", high to low)

| ID | Name | Score format | Range |
|---|---|---|---|
| `omoBestHeroes` | Heroes Tonight: Best % | Integer, suffix `%` | 0 to 100 |
| `omoBestSkyhigh` | Sky High: Best % | Integer, suffix `%` | 0 to 100 |
| `omoBestBlank` | Blank: Best % | Integer, suffix `%` | 0 to 100 |
| `omoBestInvincible` | Invincible: Best % | Integer, suffix `%` | 0 to 100 |
| `omoFlowHeroes` | Heroes Tonight: Flow | Fixed point, 1 decimal, suffix `%` | 0 to 1000 |
| `omoFlowSkyhigh` | Sky High: Flow | Fixed point, 1 decimal, suffix `%` | 0 to 1000 |
| `omoFlowBlank` | Blank: Flow | Fixed point, 1 decimal, suffix `%` | 0 to 1000 |
| `omoFlowInvincible` | Invincible: Flow | Fixed point, 1 decimal, suffix `%` | 0 to 1000 |

Flow is the share of taps on the beat in a cleared run, sent in tenths of a percent (987 shows as 98.7%).

### Achievements (800 of 1000 points)

Each needs a 1024 × 1024 image: they are in `release/achievements/`, named by ID.

| ID | Name | Earned description | Before earning | Points |
|---|---|---|---|---|
| `omoBadgeClearHeroes` | First Light | Cleared Heroes Tonight | Clear Heroes Tonight | 50 |
| `omoBadgeClearSkyhigh` | Sky High | Cleared Sky High | Clear Sky High | 75 |
| `omoBadgeClearBlank` | Blank Slate | Cleared Blank | Clear Blank | 100 |
| `omoBadgeClearInvincible` | Invincible | Cleared Invincible | Clear Invincible | 100 |
| `omoBadgeSetlist` | One More Orbit | Cleared all four levels | Clear all four levels | 100 |
| `omoBadgeInFlow` | In The Pocket | Cleared a level with 85% of taps on the beat | Clear a level with 85% of your taps on the beat | 75 |
| `omoBadgeFullDrop` | Full Send | Set off a drop at 100% | Set off a drop at 100%: fully charged and in flow | 75 |
| `omoBadgeStreak` | Locked In | Reached a streak of 60 on-beat taps | Reach a streak of 60 on-beat taps | 50 |
| `omoBadgeFewTries` | Quick Study | Cleared a level within 10 attempts | Clear a level within 10 attempts | 75 |
| `omoBadgeNoPractice` | Sight Read | Cleared a level never practised | Clear a level you have never practised | 100 |

Points cannot be changed and achievements cannot be deleted once live. Add all of these to the app version and tick Game Center on the version: on a first submission they are reviewed together with the app, and they need to be attached to the version to test in TestFlight. TestFlight uses the real Game Center, so remove test scores from the leaderboards before release.
