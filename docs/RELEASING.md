# Releasing Open Codenames

The app is distributed as source and a standalone Android APK on [GitHub Releases](https://github.com/PaoloConteDev/OpenCodenames/releases). It does not use Expo Go, an update server or Google Play at runtime.

1. Update `package.json` and `package-lock.json` together, and increase `android.versionCode` in `app.config.js`. App and multiplayer compatibility versions come from the same package version.
2. Update the changelog and README files. Preserve the distinction between automated/emulator checks and physical-device tests.
3. Configure the existing private release signing key using the environment variables below. Never commit a key or password. Future updates require the same key and a higher Android version code.
4. Run `npm ci`, `npm run format:check` and `npm run build:android`. The build performs license generation, type checks, TypeScript tests, Expo prebuild, native JVM tests and release assembly. Its default includes ARM64, ARMv7 and x86_64.
5. Verify the APK's version, architectures and signing certificate with Android SDK `aapt` and `apksigner`. Smoke-test the standalone APK. Record actual results in `VERIFICATION.md`.
6. Commit the source, create an annotated `vX.Y.Z` tag and push both. Create a GitHub release with the APK, a source archive made from the tagged commit, SHA-256 checksums and relevant compatibility notes. Publish only after the assets are uploaded and checked.

## Signing

The build script reads:

| Variable            | Meaning                               |
| ------------------- | ------------------------------------- |
| `OC_KEYSTORE`       | Absolute path to the private keystore |
| `OC_STORE_PASSWORD` | Keystore password                     |
| `OC_KEY_ALIAS`      | Signing key alias                     |
| `OC_KEY_PASSWORD`   | Private key password                  |

Without a keystore the script creates a debug-signed local preview, which must not replace a public APK signed with the private release key. The signing key generated for 1.0.0 is stored locally under the ignored `artifacts/signing/` directory. Its password is protected with Windows DPAPI in `credentials.xml`; the local `BACKUP.txt` explains how the owner can export it for a secure backup. DPAPI credentials alone cannot be restored on a different Windows account or machine. Keep a separate encrypted backup of the keystore **and its password**. Signing material is excluded from Git and release archives.

## Assets

The public release certificate SHA-256 fingerprint is `4649f3eee3abac043bcaf81d442885b577c672ff8d3969c30e4b6841f665d71d`. Check it with `apksigner verify --print-certs` when preparing updates.

Public asset names use `OpenCodenames-X.Y.Z.apk`, `OpenCodenames-X.Y.Z-source.zip` and `SHA256SUMS`. Source archives must include the local Kotlin module, licenses and all bundled content, and exclude generated Android projects, dependencies, logs, device captures and signing material. GitHub also provides its standard source archives for the tag.
