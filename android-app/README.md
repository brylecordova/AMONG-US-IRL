# AMONG-US IRL — Android Companion App

Native Android WebView shell with **CameraX + ML Kit Barcode Scanning** and a **5 FPS Rear Security Camera Service** so players can scan task badges, suit QRs, Emergency/Reactor QRs, and the Security Monitor (`CAMS`) QR over plain local Wi-Fi (`http://192.168.x.x:3000`) without HTTPS certificate setup.

## Option A: Build Automatically via GitHub Actions (No Android Studio Needed)

1. Push this repository to GitHub.
2. Open the **Actions** tab and run **Build Android Companion APK** (or push any change under `android-app/`).
3. Download the **`among-us-irl-apk`** artifact (`among-us-irl.apk`).
4. On your Host PC, drag and drop `among-us-irl.apk` into **Mission Control → Android Companion App** (or save it as `public-apk/among-us-irl.apk`).
5. Players scan the **Android Companion App** QR code on the Host PC to download and install the `.apk` over Wi-Fi.

## Option B: Build Locally in Android Studio

1. Open the `android-app/` folder in **Android Studio**.
2. Wait for Gradle Sync (downloads Android SDK 35, CameraX 1.4, and ML Kit Barcode Scanning).
3. Click **Build → Build Bundle(s) / APK(s) → Build APK(s)** (or **Generate Signed Bundle / APK**).
4. Locate the generated `.apk` inside `android-app/app/build/outputs/apk/`.
5. Drag and drop the `.apk` into **Mission Control → Android Companion App** (or place it inside `public-apk/`).

## How Players Use the App

1. Connect phone and Host PC to the same Wi-Fi network.
2. Open **AMONG-US IRL** on Android and tap **Scan Host Join QR Code** (aim at the Host PC's **Join Mission QR**).
3. Grant **Camera** (and notification permission on Android 13+) when prompted. All in-game QR scans automatically use the native CameraX scanner and stay open until a valid QR code is scanned or closed manually.
4. **Live Security Cam (`CAMS`)**: During an active match, `SecurityCamService` stays in standby and streams your rear camera at ~5 FPS only while another player is actively watching your feed on the Security Monitor (with a live banner/notification indicator).
5. **Auto-Rejoin, Change Host, & Leave Lobby**: Closing or refreshing the app automatically rejoins your active match. Tapping **Change Host** switches the Host URL while preserving saved session data, whereas tapping **Leave Lobby** shows a confirmation dialog and clears saved auto-rejoin data so you exit cleanly.
