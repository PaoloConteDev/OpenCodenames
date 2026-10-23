# Changelog

## 1.0.0 — 2026-10-23

First public GitHub release of Open Codenames, by Gleetch.

- Standalone Android game with an original identity, animated interface and bundled content.
- Local Wi-Fi/hotspot rooms for up to 10 devices; Bluetooth Classic rooms for up to 8 directly connected devices.
- Experimental Bluetooth bridges for up to 10 devices in total, subject to hardware support.
- Classic play with individual roles, shared devices from 2 phones, and a single-device pass-and-play mode.
- Host approvals, balanced teams, one spymaster per team, team shuffle and optional turn timers with automatic team changes.
- Persistent rooms, reconnection and state synchronization for returning participants.
- Italian, English, Spanish, German and French interfaces, rules and word decks; first-launch system-language detection with English fallback.
- Exact app-version compatibility checks across hosts, clients and bridges.
- English and Italian README files, MIT source license and bundled third-party notices.
- Android version code 19; the public APK uses a private release signing key.

### Compatibility and validation

Android 7.0 or later. All multiplayer participants must install the same exact app version. The release key differs from the debug key used by earlier local previews; those previews must be uninstalled before installing the public APK, which deletes their local saves and settings.

Bluetooth discovery, simultaneous connection capacity and experimental bridges require physical-device testing; no cross-device hardware certification is claimed. Hotspot client limits also depend on the phone. See [verification history](docs/VERIFICATION.md) and the [physical-device checklist](docs/DEVICE_TEST.md), currently maintained in Italian.
