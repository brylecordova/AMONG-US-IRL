# AMONG-US IRL

A real-time, QR-powered real-life **Among Us** social deduction game built with **Node.js, Express, WebSockets, React, TypeScript, Tailwind CSS, and MongoDB**.

Turn any house, campus floor, office, or backyard into **The Skeld**. One host PC runs Mission Control and prints QR cards for tasks and player backs, while players join from their smartphone browsers (or the companion Expo app) to complete 16 interactive *Among Us* task mini-games, investigate suspects, report bodies, and vote in emergency meetings.

---

## Key Features

- **Host PC Command Center & Print Studio**
  - Displays a live **Join Mission QR Code** for instant smartphone onboarding.
  - Supports **LAN IP auto-detection** and custom **Port-Forwarded / Public URLs** so remote friends can join seamlessly.
  - Built-in `@media print` **QR Print Studio** (with **Save Printable HTML** export fallback) to print:
    - **12 Player Suit Back Badges** (printed 2 per page with oversized QR codes—worn on players' backs for kills, Investigator scans, and dead body reports)
    - **16 Skeld Task Station Cards** (custom room-themed cards with unique icons, printed 4 per page)
    - **Cafeteria Emergency Meeting Button Card** (printed full crewmate-badge size)
- **16 Authentic Skeld Task Mini-Games**
  - Interactive touch-first replicas of *The Skeld* base map tasks complete with original room and tier (`COMMON`, `SHORT`, `LONG`) designations and visual-task indicators.
- **Hidden Roles & Social Deduction Mechanics**
  - **Crewmate**: Scan task QR codes to fill the global task meter, and scan dead players' back QR codes to report bodies.
  - **Investigator**: Special Crewmate role that can scan alive players' back QRs to reveal their **Suit Color** and **Role Alignment** (`CREWMATE` or `IMPOSTOR`).
  - **Impostor**: Scan an alive Crewmate's back QR to eliminate them—triggering an immediate **"YOU HAVE BEEN KILLED"** screen on the victim's phone and converting them into a Ghost.
  - **Shapeshifter** *(auto-assigned when 2 Impostors are enabled)*: One of the two Impostors is designated Shapeshifter—when scanned by an Investigator, they register as **`CREWMATE`** alongside their true suit color.
- **Dual-Mode QR Scanner + Native Expo Mobile App (`mobile-expo/`)**
  - Browser clients support live `jsQR` camera scanning, a photo capture fallback, and 1-tap manual code entry (`WIR1`, `RED`, `EMRG`).
  - Includes a standalone **React Native (Expo)** app inside `mobile-expo/` powered by `expo-camera` so Android and iOS players get instant native rear-camera QR scanning over plain `http://192.168.x.x:3000` LAN connections without needing HTTPS certificates.
- **Role Reveal Splash & Plain Crewmate Stealth HUD**
  - Plays an animated **"SHHHHH!" -> Role Reveal** splash screen at mission launch, then hides all special role UI behind an identical **Plain Crewmate HUD** (`Scan QR` + `Terminal`) so accidental shoulder-surfing never exposes Impostors or Investigators. Tap **Terminal** and unlock privately to check cooldowns or trigger sabotages.
- **MongoDB Persistence with Automatic Local Fallback**
  - Connects to MongoDB via `MONGODB_URI` when configured/running, and automatically falls back to a local disk-backed JSON store (`.skeld-data/sessions.json`) if no MongoDB instance is reachable.

---

## Prerequisites

- **Node.js** `v20.19+` or `v22.12+` (recommended `v22 LTS`) and **npm**
- **MongoDB** *(Optional)* — Local `mongod` (`mongodb://127.0.0.1:27017`) or a [MongoDB Atlas](https://www.mongodb.com/atlas) cluster. If omitted or unreachable, the server automatically persists sessions locally.

---

## Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/<your-username>/among-us-irl.git
cd among-us-irl
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env` and adjust as needed:

```bash
cp .env.example .env
```

Example `.env`:

```env
# Optional: MongoDB connection string (local or MongoDB Atlas)
# Leave blank to use automatic local persistent storage (.skeld-data/sessions.json)
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB_NAME=skeld_irl

# Optional: Public URL used when generating the Join Mission QR code
# Useful when hosting behind port forwarding, ngrok, or Cloudflare Tunnel
APP_URL=

# Server port (defaults to 3000)
PORT=3000
```

### 4. Run the Application

**Development mode** (Express + WebSockets + Vite HMR middleware on port `3000`):

```bash
npm run dev
```

**Production build & start**:

```bash
npm run build
NODE_ENV=production npm start
```

Open **`http://localhost:3000`** on your Host PC!

> **Troubleshooting on Windows:**
> - **`'tsx' is not recognized`:** Run `npm install` inside the project folder first so `node_modules/.bin/tsx` is installed, or start with `npx tsx server.ts`.
> - **`Cannot find native binding` / `@rolldown/binding-win32-x64-msvc`:** This happens if `node_modules`/`package-lock.json` came from a failed install (`npm/cli#4828`) or your Node.js version is older than `20.19.0`.
>   1. Update Node.js to **v22 LTS** (`>=22.12.0` or `>=20.19.0`).
>   2. Delete `node_modules` and `package-lock.json`, then do a clean install:
>      ```bat
>      rmdir /s /q node_modules
>      del package-lock.json
>      npm install
>      ```
>   3. If the error still appears, install the Windows binding (or fallback WASI binding) explicitly:
>      ```bat
>      npm install --no-save @rolldown/binding-win32-x64-msvc
>      ```

---

## Native Mobile App (React Native / Expo)

For the smoothest Android & iOS experience—especially **live rear-camera QR scanning on Android over plain Wi-Fi (`http://192.168.x.x:3000`)** without browser HTTPS restrictions—run the companion Expo client inside `mobile-expo/`:

```bash
cd mobile-expo
npm install
npx expo start
```

1. Open **Expo Go** on Android/iOS (connected to the same Wi-Fi as the Host PC) and scan the terminal QR code.
2. In the app, tap **Scan Host PC Join QR Code** and point your phone at the **Join Mission** QR displayed on the Host PC—both the LAN server URL and Mission Code fill in automatically.
3. See [`mobile-expo/README.md`](./mobile-expo/README.md) for optional standalone Android APK build instructions via EAS.

---

## Local Network (LAN) & Port Forwarding Guide

Players join the game from their smartphones, so phones must be able to reach your Host PC on port `3000`:

### Option A: Same Wi-Fi / LAN
1. Run `npm run dev` (or `npm start`) on your Host PC. The server automatically binds to `0.0.0.0:3000` and logs your LAN IP addresses in the terminal (e.g., `http://192.168.1.42:3000`).
2. In the Host PC **Mission Control** panel, click one of the detected **`Use http://192.168.x.x:3000`** buttons to update the **Join Mission QR Code**.
3. Ensure your OS firewall allows incoming TCP traffic on port `3000`.

### Option B: Port Forwarding / Remote Connections
1. Forward external TCP port `3000` (or `80`/`443`) to your Host PC's local IP on port `3000` in your router settings—or use an HTTPS tunnel such as `cloudflared` or `ngrok`:
   ```bash
   npx cloudflared tunnel --url http://localhost:3000
   ```
2. Paste the public URL (e.g., `https://your-host.example.com` or `http://<public-ip>:3000`) into the **Host Address** field on **Mission Control** and click **Update QR**.

> **Smartphone & Localhost Camera Notes:**
> - **Best on Android LAN:** Use the **React Native (Expo)** app in `mobile-expo/` for unrestricted live `CameraView` QR scanning over plain `http://192.168.x.x:3000`.
> - **`localhost` (`http://localhost:3000`):** Browsers allow live camera streaming on `localhost`. If your webcam does not open automatically, ensure camera permission is allowed in your browser's site settings (padlock icon) and click **Retry Camera**.
> - **Browser on LAN IP (`http://192.168.x.x:3000`):** Mobile Safari/Chrome blocks live `getUserMedia` video streams on plain HTTP LAN IP addresses. Inside the web scanner you can still tap **Take Photo of QR Code (HTTP Camera Fallback)** or enter manual codes (`WIR1`, `RED`, `EMRG`), or boot with `./certs/key.pem` & `./certs/cert.pem` (`SSL_KEY_FILE` / `SSL_CERT_FILE`).

---

## How to Host & Play

### Step 1: Prepare & Print QR Cards
1. Click **Host Game (PC)** on the Title Screen.
2. Open the **Print QR Studio** tab in the top navigation bar.
3. Click **Print Sheets** to print:
   - **Player Back Badges** (all 12 Skeld colors, or filter to **Joined Players Only** after everyone joins). Tape or pin each badge onto the **back** of each player's shirt.
   - **16 Skeld Task Cards** — hide/tape these around different rooms in your play area (e.g., *Fix Wiring* near an outlet, *Submit Scan* in a hallway, *Empty Chute* near a bin).
   - **Emergency Meeting Button** — place in your central gathering room (*Cafeteria*).

### Step 2: Configure Rules & Join Lobby
1. In **Rules & Balance**, set:
   - **Impostors**: `1` or `2` *(2 Impostors requires at least 4 players and automatically makes 1 Impostor the **Shapeshifter**)*.
   - **Investigators**: `0`, `1`, or `2`.
   - **Tasks Per Player**, **Kill Cooldown**, **Investigator Scan Cooldown**, **Sabotage Cooldown**, **Discussion Time**, **Voting Time**, **Confirm Ejects**, and **Hide Manual Codes (Anti-Remote Kill)** *(hides short codes from printed sheets and scanner input so Impostors must scan physical QR badges up close)*.
2. Players scan the **Join Mission QR Code** on the Host PC screen (via the Expo app or smartphone browser), enter their callsign, and pick the **Suit Color** matching the printed QR badge on their back.
3. Click **Launch Mission**! Every phone plays the **SHHHHH! -> Role Reveal** splash screen, then switches to the **Plain Crewmate Stealth HUD**.

### Step 3: Gameplay Loop
- **Completing Tasks**: Walk to a physical Task QR station, tap **Scan QR** on your phone, scan the QR (or type its 4-character manual code), and beat the interactive Skeld mini-game.
- **Impostor Eliminations & Investigations (Unified `Scan QR`)**: All players use the same **Scan QR** button—if an **Impostor/Shapeshifter** scans an alive Crewmate's back badge while kill cooldown is ready, the kill executes automatically (Victim gets **"YOU HAVE BEEN KILLED"**); if an **Investigator** scans an alive player while scan cooldown is ready, they receive the player's **Suit Color** and **`CREWMATE` / `IMPOSTOR`** reading *(Shapeshifter reads as `CREWMATE`!)*.
- **Private Ship Terminal & Impostor Sabotages**: Tap **Terminal** and unlock behind the **Privacy Lock** to inspect your hidden role, cooldown timers, or trigger Impostor sabotages:
  - **Kill Power (Blackout)**: Locks all regular tasks until an alive player scans and completes **Fix Wiring (`WIR1`)** to restore grid power.
  - **Signal Jam (60s)**: Disables the Cafeteria **Emergency Meeting (`EMRG`)** button for 60 seconds (dead body reports still work).
- **Rejoining After Page Refresh**: Every player receives a unique 5-character **Player Rejoin Code** (shown in Lobby/Terminal and on the Host PC's Crew Manifest). If a player refreshes or disconnects, choose **Rejoin Game** and enter the **Mission Code** + **Player Rejoin Code** to restore their session.
- **Reporting, Discussion & Voting**: Any alive player who scans a dead player's back QR receives a **Dead Body Found** prompt with a **Call Emergency Meeting** button (or players can scan the Cafeteria **Emergency Button** QR). Every phone sounds an alarm and opens **Gathering Check-In**—once all alive players tap **`HERE!`**, **Discussion** begins (players can agree via **Vote Now** to skip discussion early once everyone consents). During **Voting**, alive players vote for a suspect or click **Skip Vote**, and the **Verdict** reveals who voted for whom before ejection.
- **Winning**:
  - **Crewmates Win** by ejecting all Impostors OR reaching **100%** global task completion.
  - **Impostors Win** when alive Impostors equal or outnumber alive Crewmates.

---

## Reference: 16 Skeld Tasks & Manual Codes

| Task Name | Skeld Room | Tier | Visual Task | Manual Code |
| :--- | :--- | :--- | :---: | :---: |
| **Fix Wiring** | Electrical | Common | — | `WIR1` |
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
- **Player Back Badges**: `RED`, `BLU`, `GRN`, `PNK`, `ORG`, `YLW`, `BLK`, `WHT`, `PRP`, `BRN`, `CYN`, `LIM`

---

## Tech Stack

- **Backend**: Node.js, Express, `ws` (WebSockets), `mongodb` driver (with automatic JSON persistence fallback)
- **Web Frontend**: React 19, TypeScript, Tailwind CSS v4, Motion (`motion/react`), Lucide Icons, Web Audio API synthesizer
- **Mobile Client (`mobile-expo/`)**: React Native (Expo SDK 52), `expo-camera` (`CameraView` QR scanning), React Native `Animated`, `react-native-svg`
- **QR Engine**: `qrcode` (print & join QR generation), `jsqr` (web camera QR decoding), native `expo-camera` barcode scanner
