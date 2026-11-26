# AMONG-US IRL

A real-time, QR-powered real-life **Among Us** social deduction game built with **Node.js, Express, WebSockets, React, TypeScript, Tailwind CSS, MongoDB, Kotlin/CameraX (`android-app/`), and React Native / Expo (`mobile-expo/`)**.

Turn any house, campus floor, office, or backyard into **The Skeld**. One host PC runs **Mission Control** and prints QR cards for tasks, player backs, Security Cameras, Reactor Override, and the Emergency Button, while players join via the **Android Companion `.apk`**, **smartphone browser**, or **`mobile-expo` client**.

---

## Key Features

- **Host PC Command Center & Print QR Studio**
  - Displays a live **Join Mission QR Code** and hosts downloadable **`among-us-irl.apk`** builds via `public-apk/`.
  - Supports **LAN IP auto-detection** and custom **Port-Forwarded / Tunnel URLs** so local or remote players can join easily.
  - Built-in `@media print` **QR Print Studio** (with **Save Printable HTML** fallback) to print:
    - **12 Player Suit Back Badges** (2 per page with oversized QRs for kills, forensic scans, Sheriff shots, and body reports)
    - **16 Skeld Task Station Cards** (custom room-themed cards, 4 per page)
    - **Cafeteria Emergency Meeting Button (`EMRG`)**
    - **Reactor Override QR (`MELT`)**
    - **Security Camera Terminal QR (`CAMS`)**
- **Live 5 FPS Security Camera CCTV (`CAMS`)**
  - Alive players scan the **Security Camera QR** (`SKELD|SECURITY|<SESSION>|CAMS` or `CAMS`) during active gameplay to open **Security Monitor** and view any alive crewmate's rear camera at **5 FPS** (one player feed at a time).
  - Watched targets see a blinking **`SECURITY CAM ACTIVE`** alert banner (plus a foreground notification in the Android `.apk` and Android's camera indicator).
  - **Comms Signal Jam** cuts all feeds to **`SIGNAL JAMMED`**, and feeds automatically handle QR scanner handoff (**`SCANNING QR TERMINAL`**), elimination (**`SIGNAL LOST — DECEASED`**), meetings, and disconnects.
  - Works in the **Android `.apk`** (CameraX foreground service), **browser clients**, and **`mobile-expo`** (including multi-tab Expo Web testing with automatic test-feed canvas fallback if a browser tab has no hardware camera).
- **16 Authentic Interactive Skeld Tasks & Blackout Repairs**
  - Interactive touch-first replicas of *The Skeld* base map tasks (`COMMON`, `SHORT`, `LONG`) with visual task indicators.
  - During a **Power Blackout**, regular tasks lock and **any alive player**—even if they already finished Fix Wiring or weren't assigned it—can scan **`WIR1`** to restore ship power.
- **Hidden Roles & Social Deduction Mechanics**
  - **Crewmate**: Complete tasks to reach 100% and scan dead bodies to report them.
  - **Investigator**: Scan alive players' back QRs to reveal their **Suit Color** and **Alignment** (`CREWMATE` or `IMPOSTOR`).
  - **Sheriff**: Scan an alive player's back QR to shoot; hitting an Impostor/Shapeshifter eliminates them, while misfiring on an innocent Crewmate eliminates the Sheriff.
  - **Guardian Angel**: Shield any player (including Impostors) temporarily—and continue shielding even after death as a Ghost.
  - **Jester**: Wins solo immediately if ejected by vote during a meeting.
  - **Impostor & Shapeshifter**: Eliminate Crewmates by scanning their back QR; when 2 Impostors are active, one becomes the **Shapeshifter** (reads as **`CREWMATE`** to Investigators).
- **3 Sabotage Systems & Remote Reactor Trigger**
  - **Kill Power (`BLACKOUT`)**: Locks tasks until Fix Wiring (`WIR1`) is repaired.
  - **Comms Signal Jam (`SIGNAL_JAM`, 60s)**: Disables Emergency Meetings (`EMRG`) and Security Cameras (`CAMS`).
  - **Reactor Meltdown (`REACTOR` / `MELT`)**: Impostors scan the physical **Reactor Override** QR to arm a remote trigger without immediate detonation, walk away, and trigger or cancel remotely from their **Terminal**. Crewmates must hold the Reactor stabilizer before the countdown hits 0.
- **Three Client Options + Auto-Rejoin & Leave Confirmation**
  - **Native Android `.apk` (`android-app/`)**: Kotlin WebView shell with **CameraX + ML Kit** instant QR scanning over plain `http://192.168.x.x:3000` Wi-Fi, native haptics, **Change Host**, **Leave Lobby** (with confirmation popup that clears saved auto-rejoin storage), and **CameraX 5 FPS Security Cam Service**.
  - **Expo Client (`mobile-expo/`)**: React Native / Expo SDK 52 app for iOS, Android (Expo Go), and multi-tab Expo Web testing—includes native `CameraView` QR scanning, CCTV monitoring/streaming, and confirmation popups on **Leave Lobby** and **Exit**.
  - **Web Browser Client (`src/`)**: Live `jsQR` scanning, photo fallback, manual code entry, and auto-rejoin persistence (`localStorage`).
- **Role Reveal Splash, Stealth HUD & Meeting Flow**
  - Plays **"SHHHHH!" -> Role Reveal** once at mission start, then hides special roles behind an identical **Plain Crewmate Stealth HUD** (`Scan QR` + privacy-locked `Terminal`).
  - Dead body scans show a **Call Emergency Meeting** prompt; meetings run **Gathering (`HERE!`) -> Discussion (unanimous `Vote Now` skip) -> Voting (`Skip Vote` + live voter icons) -> Ejection Verdict** (who voted for whom).
- **MongoDB Persistence with Automatic Local Fallback**
  - Uses MongoDB via `MONGODB_URI` when configured, or automatically persists sessions to `.skeld-data/sessions.json`.

---

## Prerequisites

- **Node.js** `v20.19+` or `v22.12+` (recommended `v22 LTS`) and **npm**
- **MongoDB** *(Optional)* — Local `mongod` (`mongodb://127.0.0.1:27017`) or MongoDB Atlas. If omitted, sessions are stored locally in `.skeld-data/sessions.json`.

---

## Installation & Setup

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/<your-username>/among-us-irl.git
cd among-us-irl
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and adjust as needed:

```bash
cp .env.example .env
```

```env
# Optional: MongoDB connection string (local or MongoDB Atlas)
# Leave blank to use automatic local persistent storage (.skeld-data/sessions.json)
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB_NAME=skeld_irl

# Optional: Public URL used when generating the Join Mission QR code
APP_URL=

# Server port (defaults to 3000)
PORT=3000
```

### 3. Run the Application

**Development mode** (Express + WebSockets + Vite middleware on port `3000`):

```bash
npm run dev
```

**Production build & start**:

```bash
npm run build
NODE_ENV=production npm start
```

Open **`http://localhost:3000`** on your Host PC.

> **Troubleshooting on Windows:**
> - **`'tsx' is not recognized`:** Run `npm install` inside the project root first, or start with `npx tsx server.ts`.
> - **`Cannot find native binding` / `@rolldown/binding-win32-x64-msvc`:** Update Node.js to **v22 LTS** (`>=22.12.0` or `>=20.19.0`), delete `node_modules` and `package-lock.json`, and run `npm install` again (or `npm install --no-save @rolldown/binding-win32-x64-msvc`).

---

## Android Companion APK (`android-app/`)

For live games on Android phones over plain LAN Wi-Fi (`http://192.168.x.x:3000`) with CameraX QR scanning and background 5 FPS Security Cam streaming:

- Build automatically via the GitHub Actions workflow (**Build Android Companion APK**) or locally in Android Studio from `android-app/`.
- Drop the built `among-us-irl.apk` into `public-apk/` (or drag-and-drop it into **Mission Control → Android Companion App**) so players can scan and install it directly over Wi-Fi.
- Note: Tapping **Change Host** in the `.apk` toolbar returns to the launcher without clearing saved auto-rejoin credentials; tapping **Leave Lobby** shows a confirmation dialog, exits the mission, and clears saved auto-rejoin storage.
- See [`android-app/README.md`](./android-app/README.md) for full build details.

---

## Expo Mobile / Multi-Tab Test Client (`mobile-expo/`)

```bash
cd mobile-expo
npm install
npx expo start
```

- Scan the Expo CLI QR code with **Expo Go** on Android/iOS, or press **`w`** to open multiple browser tabs for local multi-player and CCTV testing.
- See [`mobile-expo/README.md`](./mobile-expo/README.md) for details.

---

## Local Network (LAN) & Port Forwarding Guide

1. **Same Wi-Fi / LAN**: Run `npm run dev` (binds `0.0.0.0:3000`), click a detected **`Use http://192.168.x.x:3000`** button in **Mission Control**, and ensure your firewall allows TCP port `3000`.
2. **Remote / Tunnel**: Forward port `3000` or start an HTTPS tunnel (e.g., `npx cloudflared tunnel --url http://localhost:3000`) and paste the URL into **Host Address** on Mission Control.

---

## Reference: Tasks, Stations & Manual Codes

| Station / Task | Skeld Room | Tier | Visual Task | Manual Code |
| :--- | :--- | :--- | :---: | :---: |
| **Fix Wiring** *(also repairs Blackout)* | Electrical | Common | — | `WIR1` |
| **Swipe Card** | Admin | Common | — | `CRD2` |
| **Clear Asteroids** | Weapons | Short | Yes | `AST3` |
| **Upload Data** | Cafeteria / Admin | Short | — | `DAT4` |
| **Fuel Engines** | Storage / Engine | Long | — | `FUL5` |
| **Submit Scan** | MedBay | Short | Yes | `MED6` |
| **Inspect Sample** | MedBay | Long | — | `SMP7` |
| **Prime Shields** | Shields | Short | Yes | `SHD8` |
| **Start Reactor** | Reactor | Long | — | `RCT9` |
| **Unlock Manifolds** | Reactor | Short | — | `MNF1` |
| **Align Engine Output** | Upper Engine | Short | — | `ALN2` |
| **Empty Chute** | O2 / Storage | Short | Yes | `GRB3` |
| **Calibrate Distributor** | Electrical | Short | — | `CAL4` |
| **Divert Power** | Electrical | Short | — | `PWR5` |
| **Clean O2 Filter** | O2 | Short | — | `OXY6` |
| **Chart Course** | Navigation | Short | — | `NAV7` |

**Other Manual Codes**:
- **Emergency Meeting Button**: `EMRG`
- **Security Camera Monitor (CCTV)**: `CAMS` *(aliases: `SEC1`, `SECCAM`, `SECURITY`)*
- **Reactor Meltdown Override**: `MELT`
- **Player Back Badges**: `RED`, `BLU`, `GRN`, `PNK`, `ORG`, `YLW`, `BLK`, `WHT`, `PRP`, `BRN`, `CYN`, `LIM`

*(Enable **Hide Manual Codes (Anti-Remote Kill)** in Mission Control rules to hide short codes from printed sheets and disable manual code entry.)*

---

## Tech Stack

- **Backend**: Node.js, Express, `ws` (WebSockets), `mongodb` driver (with automatic JSON persistence fallback)
- **Web Frontend**: React 19, TypeScript, Tailwind CSS v4, Motion (`motion/react`), Lucide Icons, Web Audio API synthesizer
- **Android APK (`android-app/`)**: Kotlin, Android WebView + JS Bridge, CameraX 1.4, ML Kit Barcode Scanning, Camera Foreground Service
- **Expo Client (`mobile-expo/`)**: React Native (Expo SDK 52), `expo-camera`, React Native `Animated`, `react-native-svg`
- **QR Engine**: `qrcode`, `jsqr`, native ML Kit & `expo-camera` barcode scanning
