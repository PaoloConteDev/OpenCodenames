# Open Codenames

**by Gleetch** · English | [Italiano](README.it.md)

An independent, open-source Android word and spy game for people in the same room. Two teams, 25 words, secret identities and one clue at a time. Play together over local Wi-Fi, a phone hotspot or Bluetooth, or pass a single phone around.

No accounts, ads, telemetry, cloud services or Internet connection are required to play. Interfaces, rules, fonts and word decks are bundled in the app. Original code and content are MIT-licensed. This project is not affiliated with Czech Games Edition.

**[Download version 1.0.0](https://github.com/PaoloConteDev/OpenCodenames/releases/tag/v1.0.0)** · [Changelog](CHANGELOG.md) · [Report an issue](https://github.com/PaoloConteDev/OpenCodenames/issues)

<p align="center">
  <img src="docs/screenshots/home.png" width="320" alt="Open Codenames home screen">
  <img src="docs/screenshots/game.png" width="320" alt="Open Codenames game screen with the 25-card board">
</p>

## Install and play

1. Download `OpenCodenames-1.0.0.apk` from the release page on an Android phone running **Android 7.0 or later**.
2. Allow your browser or file manager to install this APK when Android asks. Open the installed app; no Expo account, Expo Go, Metro server or PC is needed.
3. Tap **Play**, choose a channel and either host or join a room. For single-device play, go straight to game setup without entering a nickname.
4. In multiplayer, the host approves joining players. Choose roles, mark everyone ready and start the mission.

All phones in a room must run the **same exact app version**, including patch releases. The app rejects incompatible versions, including on reconnect and through bridges. Check your installed version in Settings.

The public 1.0.0 APK uses a private release signing key. Earlier local previews used a debug key and must be uninstalled before installing this APK; uninstalling deletes their saved rooms and settings. Future public updates will use the release key.

## Channels and device limits

| Channel                       | Devices, including the host | Requirements                                                             |
| ----------------------------- | --------------------------- | ------------------------------------------------------------------------ |
| Wi-Fi / hotspot               | 2–10                        | Same local network; no Internet required                                 |
| Bluetooth Classic             | 2–8 directly connected      | Android Bluetooth permissions, pairing and a visible host                |
| Single device                 | 1                           | Pass the phone between roles and teams                                   |
| Experimental Bluetooth bridge | Up to 10 in total           | A connected participant acts as a bridge for up to two additional phones |

These are application limits. The effective number of connections depends on the phones, Bluetooth controllers and hotspot configuration. **Bluetooth capacity and bridges have not been certified across physical devices.** A hotspot may allow fewer clients than the app. See [validation history](docs/VERIFICATION.md) and the [physical-device checklist](docs/DEVICE_TEST.md), currently in Italian.

### Wi-Fi / hotspot

Connect everyone to the same Wi-Fi network or a phone hotspot. Mobile data can stay off. The host opens a room and shares its QR code or private IPv4 address and room code. Joining players scan or enter these details, then wait for approval. Allow camera access only if using the scanner.

If Android asks to leave a network without Internet, stay connected. Router client isolation can prevent phones from reaching each other. The app does not change Wi-Fi, hotspot or mobile-data settings automatically. The local TCP listener uses port `42831` and accepts private IPv4 connections; it does not contact a public backend.

### Bluetooth

The host opens a Bluetooth room and makes the phone visible through Android's system dialog. Other phones search for that host, pair if asked and request admission. Visibility lasts five minutes and can be renewed; established connections do not need continued visibility.

If the host is missing, renew visibility and search again, or pair the phones in Android Settings first. Paired and detected devices remain selectable even when service discovery is incomplete. A manual Bluetooth address entry is also available. Android 7–11 may require both location permission and the system Location switch for discovery; the app does not collect coordinates. Android 12 and later use Nearby devices permissions.

For experimental bridges, an approved participant connected directly to the host enables bridge mode. Up to two extra participants connect through that phone and must compare the host fingerprint against the real host before sending credentials. The host still approves admission and remains the sole game authority. Bridged traffic is encrypted end to end; nested bridges and automatic bridge migration are unsupported. The host and bridge must remain in the foreground. Hardware support is experimental, so use local Wi-Fi/hotspot if simultaneous Bluetooth links fail.

## Ways to play

| Game management | Devices                            | Roles and handoffs                                                                                 |
| --------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| Classic         | 4–10, subject to the channel limit | Individual teams and roles; exactly one spymaster per team                                         |
| Shared          | 2–10, subject to the channel limit | One phone for both spymasters, one or more phones for decoders; pass each phone to the active team |
| Single device   | 1                                  | One phone for both teams and both roles, with a confirmation before each handoff                   |

In shared and single-device play, follow the handoff screen before revealing private information. In single-device play the secret map is hidden as soon as a clue is submitted; decoders confirm the handoff before choosing cards. Do not pass the phone while a secret map is visible.

In Classic lobbies, new players alternate between red and blue. Each team's spymaster appears first; the host can shuffle balanced teams and reset readiness for everyone to confirm again.

The optional **turn timer** offers 30, 60, 90, 120 or 180 seconds. A turn includes the clue, guesses and phone handoffs. When time runs out, the host automatically switches teams. No timer is enabled by default.

## Rules at a glance

The 5×5 board contains 9 words for the starting team, 8 for its opponent, 7 neutral words and 1 assassin. Spymasters see the secret map and give a word clue plus a number. Decoders choose cards for their team. Standard clues allow up to N+1 guesses; zero and infinity allow unlimited guesses. A team must attempt at least one guess before ending its turn. Revealing the assassin loses immediately; revealing a team's last word wins for that team, even if its opponent picked it.

Revealed cards become darker. A colored dot records the team that selected a card, independently of the card's secret identity. Team and role are also shown in the game header.

The in-app rules explain clue syntax and fair play. Automatic validation checks syntax and board-word matching; it does not judge clue meaning or who is physically holding a shared phone.

## Languages

Italian, English, Spanish, German and French are available offline. The flag button next to Settings on the home screen opens the language picker.

On first launch, the app reads Android's primary system language. Supported languages are recognized across regional variants, such as `es-MX` or `fr-CA`; other languages default to **English**. The initial choice is saved. A saved preference takes priority over later system-language changes and can be changed manually at any time. Android system dialogs follow Android's own language.

The host's language when creating a room determines its word deck:

| Language | Included words |
| -------- | -------------: |
| Italian  |          1,022 |
| English  |            588 |
| Spanish  |            574 |
| German   |            580 |
| French   |            576 |

All participants receive the same board words, while each phone can use a different interface language. Changing the interface or resuming a room preserves its deck, including later missions in that room. Create a new room to change the deck language. Nicknames, player-written clues and board words are never automatically translated.

## Reconnection and saved games

Non-host participants can lock their phone or switch apps. On return they reconnect and synchronize with the current session before taking action; old pending commands are not replayed. The host and any active Bluetooth bridge should keep the app in the foreground; their screens stay awake while serving the room.

If the host is suspended, hosting pauses and the remaining turn time is saved. On return the transport reopens and the timer resumes. After an unexpected process termination, recovery uses the saved deadline and applies at most one overdue team switch. A new handoff confirmation protects the map when resuming single-device play.

The host stores one recoverable room; creating another replaces it. A client remembers its last approved session. Explicitly leaving disables automatic rejoin. Local data is stored privately with atomic writes; Android backup is disabled and uninstalling removes it. Host migration is unsupported. If a saved LAN host changes IP address, restore its old address or create/rejoin a room with the new details.

## Build from source

Requirements: **Node.js 22 LTS (22.13 or later)**, npm, JDK 17 or 21, Android SDK Platform 36, Build Tools 36.0.0, NDK 27.1.12297006 and the CMake required by React Native. Downloading development dependencies requires Internet; playing the compiled APK does not.

The provided build script runs on Windows PowerShell:

```powershell
git clone https://github.com/PaoloConteDev/OpenCodenames.git
cd OpenCodenames
npm ci
npm run build:android
```

Set `JAVA_HOME` and `ANDROID_HOME` if your JDK and SDK are outside the script's default Android Studio locations. The script regenerates the original logo assets and third-party notices, checks types, runs TypeScript and native JVM tests, generates `android/` with Expo prebuild, and assembles a release variant with JavaScript and fonts embedded.

By default it includes ARM64, ARMv7 and x86_64. To select architectures:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-android.ps1 -Architectures arm64-v8a
```

Without private signing configuration, the output is `artifacts/open-codenames-preview.apk`, signed with an Android debug key for local testing. For your own distribution, configure `OC_KEYSTORE`, `OC_STORE_PASSWORD`, `OC_KEY_ALIAS` and `OC_KEY_PASSWORD`; the output becomes `artifacts/open-codenames-release.apk`. Keep keys and passwords outside source control. See [release and signing instructions](docs/RELEASING.md).

For USB development, use `npm run android` and `npm start`. For offline testing, install the standalone release-variant APK, disconnect the PC and stop Metro. Android is the supported platform; iOS, browsers and Expo Go are not supported.

## Architecture and checks

| Area           | Implementation                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| Game engine    | `src/core/engine.ts`: board generation, rules, authorization and role-filtered projections              |
| Authority      | `src/session/authority.ts`: serial commands, durable commit before acknowledgment and deduplication     |
| Protocol       | `src/protocol/`: validated messages, version checks, framing and encrypted bridge tunnels               |
| Runtime        | `src/session/runtime.ts`: admission, connections, heartbeat, recovery and UI state                      |
| Android module | `modules/offline-link/android/`: Bluetooth Classic RFCOMM/SDP, local TCP sockets and AtomicFile storage |
| Interface      | `App.tsx` and `src/ui/`: React Native, original SVG artwork, QR, accessibility and motion preferences   |
| Localization   | `src/content/` and `src/i18n/`: five decks, rules, UI catalog and message formatting                    |

The host runs the engine locally in Hermes. Kotlin handles native I/O and storage. No Node server is needed during play. Bluetooth uses Classic RFCOMM, not BLE, Nearby Connections or Google Play Services.

```powershell
npm run typecheck
npm test
npm run format:check
npm run licenses
# After Expo prebuild, with JAVA_HOME and ANDROID_HOME configured:
.\android\gradlew.bat -p android :offline-link:testReleaseUnitTest --console=plain
```

Runtime/protocol tests use controlled I/O only inside the test process. The shipped app uses real native transports. Developer-only socket tools in `scripts/` are excluded from the app. Automated and emulator results do not establish Bluetooth hardware compatibility; consult the [verification record](docs/VERIFICATION.md) for what was actually tested.

## License and contributions

Source code, original artwork, translations and word lists: [MIT](LICENSE). The bundled Space Grotesk font uses the SIL Open Font License. Dependency notices are available [in the repository](THIRD_PARTY_NOTICES.txt) and offline in Settings. See [content provenance](docs/CONTENTS.md) for details. No official game artwork or word lists are extracted from the commercial product.

Issues and contributions are welcome. For connection problems, include the app version, Android versions, phone models, channel and reproduction steps. Do not include private session credentials or signing material. Consult the existing tests and device checklist when proposing protocol or transport changes.
