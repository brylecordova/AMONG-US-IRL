# AMONG-US IRL — Native Mobile Client (React Native / Expo)

Native Android & iOS companion app for **AMONG-US IRL** powered by **`expo-camera`**.
Why use the Expo app on Android? Android phones block live browser camera scanning over plain `http://192.168.x.x:3000` LAN addresses, whereas this native Expo client grants full live rear-camera QR scanning over plain LAN HTTP without needing HTTPS certificates or ngrok.

---

## Quick Start with Expo Go (Fastest — No APK Build Needed)

1. Make sure your Host PC server is running from the project root:
   ```bash
   npm run dev
   ```
   Check your Host PC LAN address in Mission Control (for example `http://192.168.1.42:3000`).

2. Install dependencies inside `mobile-expo`:
   ```bash
   cd mobile-expo
   npm install
   npx expo start
   ```

3. Install **Expo Go** from the Google Play Store (Android) or App Store (iOS) on players' phones (connected to the same Wi-Fi), and scan the Expo CLI QR code.

4. Inside the **AMONG-US IRL** mobile app:
   - Tap **Scan Host PC Join QR Code** and point the camera at the **Join Mission** QR on your Host PC screen—this auto-fills both your Host PC URL (`http://192.168.x.x:3000`) and Mission Code.
   - Or manually type your Host Server URL + Mission Code, pick your suit color, and tap **Join Mission**.

---

## Standalone Android APK Build (Optional)

If you want to distribute an installable `.apk` file to Android players instead of using Expo Go:

1. Install EAS CLI and login:
   ```bash
   npm install -g eas-cli
   eas login
   ```
2. Add `"expo-build-properties"` so Android allows cleartext `http://192.168.x.x:3000` LAN requests in release APKs:
   ```bash
   npx expo install expo-build-properties
   ```
   Add to `app.json` `"plugins"`:
   ```json
   ["expo-build-properties", { "android": { "usesCleartextTraffic": true } }]
   ```
3. Build a preview APK:
   ```bash
   eas build -p android --profile preview
   ```

---

## Features Included
- **Live Native Camera QR Scanner (`CameraView`)**: Instant QR reading + torch toggle + camera flip + manual station code fallback (`WIR1`, `RED`, `EMRG`).
- **Start-of-Game Role Reveal Splash**: Animated `"SHHHHH!"` -> dramatic Role Reveal splash at mission start, followed by an identical **Plain Crewmate Stealth HUD** so shoulder-surfing never gives away Impostors or Investigators.
- **Privacy-Locked Ship Terminal**: Tap **Terminal** and unlock privately to check your secret role, Kill/Scan cooldowns, or trigger **Kill Power (`BLACKOUT`)** and **Signal Jam (60s)**.
- **All 16 Interactive Skeld Tasks**, **Rejoin Code Support**, and **Emergency Meeting `HERE!` Check-In**.
