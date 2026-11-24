# Skeld IRL

A real-time, QR-powered real-life **Among Us** social deduction game built with **Node.js, Express, WebSockets, React, TypeScript, Tailwind CSS, and MongoDB**.

Turn any house, campus floor, office, or backyard into **The Skeld**. One host PC runs Mission Control and prints QR cards for tasks and player backs, while players join from their smartphone browsers to complete 16 interactive *Among Us* task mini-games, investigate suspects, report bodies, and vote in emergency meetings.

---

## Key Features

- **Host PC Command Center & Print Studio**
  - Displays a live **Join Mission QR Code** for instant smartphone onboarding.
  - Supports **LAN IP auto-detection** and custom **Port-Forwarded / Public URLs** so remote friends can join seamlessly.
  - Built-in `@media print` **QR Print Studio** to print:
    - **12 Player Suit Back Badges** (worn on players' backs for kills, Investigator scans, and dead body reports)
    - **16 Skeld Task Station Cards**
    - **Cafeteria Emergency Meeting Button Card**
- **16 Authentic Skeld Task Mini-Games**
  - Interactive touch-first replicas of *The Skeld* base map tasks complete with original room and tier (`COMMON`, `SHORT`, `LONG`) designations and visual-task indicators.
- **Hidden Roles & Social Deduction Mechanics**
  - **Crewmate**: Scan task QR codes to fill the global task meter, and scan dead players' back QR codes to report bodies.
  - **Investigator**: Special Crewmate role that can scan alive players' back QRs to reveal their **Suit Color** and **Role Alignment** (`CREWMATE` or `IMPOSTOR`).
  - **Impostor**: Scan an alive Crewmate's back QR to eliminate them—triggering an immediate **"YOU HAVE BEEN KILLED"** screen on the victim's phone and converting them into a Ghost.
  - **Shapeshifter** *(auto-assigned when 2 Impostors are enabled)*: One of the two Impostors is designated Shapeshifter—when scanned by an Investigator, they register as **`CREWMATE`** alongside their true suit color.
- **Dual-Mode QR Scanner (Camera + Manual Fallback)**
  - Uses the smartphone's rear camera (`jsQR`) for instant scanning, plus a 1-tap **Manual Code Entry** fallback (`WIR1`, `RED`, `EMRG`, etc.) so gameplay works smoothly even on non-HTTPS LAN connections where mobile browsers restrict camera access.
- **MongoDB Persistence with Automatic Local Fallback**
  - Connects to MongoDB via `MONGODB_URI` when configured/running, and automatically falls back to a local disk-backed JSON store (`.skeld-data/sessions.json`) if no MongoDB instance is reachable.

---

## Prerequisites

- **Node.js** `v20+` (recommended `v22+`) and **npm**
- **MongoDB** *(Optional)* — Local `mongod` (`mongodb://127.0.0.1:27017`) or a [MongoDB Atlas](https://www.mongodb.com/atlas) cluster. If omitted or unreachable, the server automatically persists sessions locally.

---

## Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/<your-username>/skeld-irl.git
cd skeld-irl
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

> **Troubleshooting (`'tsx' is not recognized` on Windows):** Make sure you ran `npm install` inside the project folder first so `node_modules/.bin/tsx` is installed. If you still see the error, run `npm install tsx` or start the server via `npx tsx server.ts`.

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
> - **`localhost` (`http://localhost:3000`):** Browsers allow live camera streaming on `localhost`. If your webcam does not open automatically, ensure camera permission is allowed in your browser's site settings (padlock icon) and click **Retry Camera**.
> - **LAN IP (`http://192.168.x.x:3000`):** Mobile Safari/Chrome blocks live `getUserMedia` video streams on plain HTTP LAN IP addresses. You still have **two zero-setup ways to play**:
>   1. Tap **Take Photo of QR Code (HTTP Camera Fallback)** inside the scanner to snap a photo using your phone's native camera.
>   2. Or type the 3–4 letter manual code (`WIR1`, `RED`, `EMRG`) printed on every QR card.
> - **Optional Full Live Camera on LAN:** Place TLS certs at `./certs/key.pem` and `./certs/cert.pem` (or set `SSL_KEY_FILE` / `SSL_CERT_FILE` in `.env`)—the server automatically boots in **HTTPS** mode, or use `npx cloudflared tunnel --url http://localhost:3000`.

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
   - **Tasks Per Player**, **Kill Cooldown**, **Investigator Scan Cooldown**, **Voting Time**, and **Confirm Ejects**.
2. Players scan the **Join Mission QR Code** on the Host PC screen with their phone camera, enter their callsign, and pick the **Suit Color** matching the printed QR badge on their back.
3. Click **Launch Mission**!

### Step 3: Gameplay Loop
- **Completing Tasks**: Walk to a physical Task QR station, tap **Scan Task / Body** on your phone, scan the QR (or type its 4-character manual code), and beat the interactive Skeld mini-game.
- **Investigating (Investigator only)**: Tap **Investigate** and scan an alive player's back QR to reveal their **Suit Color** and whether they read as **`CREWMATE`** or **`IMPOSTOR`** *(Shapeshifter reads as `CREWMATE`!)*.
- **Eliminating (Impostors / Shapeshifter)**: Tap **Kill QR** and scan an alive Crewmate's back QR when your kill cooldown is `0s`. Their phone immediately locks with **"YOU HAVE BEEN KILLED"** and enters Ghost Mode (they can still finish tasks silently!).
- **Reporting & Voting**: Any alive player who discovers a killed player scans the dead player's back QR (or scans the Cafeteria **Emergency Button** QR). Every phone sounds an alarm and opens the **Gathering Check-In** screen—each alive player walks to the meeting table and taps **`HERE!`**. Once all alive players (excluding dead players) have checked in, the **Discussion** countdown and **Voting** begin automatically.
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
- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Web Audio API synthesizer
- **QR Engine**: `qrcode` (client-side print & join QR generation), `jsqr` (in-browser camera QR decoding)
