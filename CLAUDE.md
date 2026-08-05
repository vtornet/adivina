# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # Start the Express server (requires .env with MONGO_URI etc.)
npm run lint       # ESLint on public/js/**/*.js
npm run lint:fix   # Auto-fix lint issues
```

There are no automated tests (`npm test` is a no-op).

To run locally, copy `.env.example` (or create `.env`) with:
- `MONGO_URI` — MongoDB connection string
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`
- `EMAIL_PASS` — Resend API key (used as Bearer token)

## Architecture

**"Adivina la Canción"** is a music-guessing PWA. Players hear a short audio clip and guess the song. There is a local multiplayer mode, an online async multiplayer mode, and a special elderly mode.

### Stack
- **Backend**: `server.js` — single-file Express app with MongoDB/Mongoose, Stripe, Resend email. All API routes are in this one file.
- **Frontend**: Vanilla JS ES modules, no build step. Entry point is `public/js/main.js`.
- **Deployment**: Railway, from the `feature/refactor` branch on GitHub (`vtornet/adivina`).
- **Database**: MongoDB hosted on Railway. Data lives in the `test` database (default — MONGO_URI has no explicit DB name). Connect externally via the public proxy `shinkansen.proxy.rlwy.net:25162` with full credentials.

### Frontend Module Pattern

Because HTML `onclick` attributes can't call ES module exports directly, **every function used in HTML must be registered on `globalThis`** in `main.js`. The pattern is:

```js
// In main.js:
import { myFunction } from "./files/my-module.js";
globalThis.myFunction = myFunction;
```

When adding a new function callable from HTML, always add it to both the `import` and the `globalThis` assignment in `main.js`. Functions that only call each other within JS modules do NOT need to be on `globalThis`.

### Song Data

Songs live in `data/songs/[decade]/[category].js`. Each file assigns directly to `globalThis.allSongsByDecadeAndCategory`:

```js
globalThis.allSongsByDecadeAndCategory["80s"].espanol = [
  {
    file: "80s/espanol/artist - song.mp3",   // path under public/audio/
    display: "Artist - Song Title",
    listenUrl: "https://open.spotify.com/track/...",
    platform: "spotify",
    originalDecade: "80s",
    originalCategory: "espanol",
  },
  ...
];
```

Special cases:
- `verano/consolidated.js` and `elderly/consolidated.js` use `"consolidated"` as the category key.
- `espanol.js` and `ingles.js` for `80s`, `90s`, `00s` have real Spotify URLs. The same files for `10s` and `actual` still have placeholder strings (`URL_PENDIENTE_...`) — pending a Spotify API rate-limit reset before the script can finish. Run `python -u spotify_urls.py` from the project root once the rate limit resets.

### Decades and Categories

Defined in `public/app_info/app-info.js` and `public/js/constants/app-constants.js`.

- **Decades**: `80s`, `90s`, `00s`, `10s`, `actual`, `verano`, `Todas` (all), `elderly`
- **Categories**: `espanol`, `ingles`, `peliculas`, `series`, `tv`, `infantiles`, `anuncios`, `consolidated`
- **Premium categories** (require payment): `peliculas`, `series`, `tv`, `infantiles`, `anuncios`
- **Premium decades**: `Todas`, `verano`

### Audio Files — Current State

MP3 files live in `public/audio/[decade]/[category]/`. All files are normalized to **-14 LUFS** (EBU R128). SFX files are in `public/audio/sfx/` and are excluded from normalization.

**Which audio folders exist on the server:**

| Category | 80s | 90s | 00s | 10s | actual |
|---|---|---|---|---|---|
| espanol | ✅ | ✅ | ✅ | ✅ | ✅ |
| ingles | ✅ | ✅ | ✅ | ✅ | ✅ |
| peliculas | ✅ | ✅ | ✅ | ❌ | ❌ |
| series | ✅ | ✅ | ✅ | ❌ | ❌ |
| tv | ✅ | ✅ | ✅ | ❌ | ❌ |
| infantiles | ✅ | ❌ pending | ❌ | ❌ | ❌ |
| anuncios | ✅ | ✅ | ❌ | ❌ | ❌ |

**Known data issues in JS files:**
- `90s/infantiles.js` — has correct content (84 real 90s cartoons: Pokémon, Bob Esponja, etc.) but the `public/audio/90s/infantiles/` folder doesn't exist yet. Owner will upload the audio files.
- `00s/infantiles.js`, `10s/infantiles.js`, `actual/infantiles.js` — contain Spanish pop songs instead of children's shows (script generation error). No audio exists for these.
- `10s/series.js`, `actual/series.js`, `10s/tv.js`, `actual/tv.js`, `10s/peliculas.js`, `actual/peliculas.js`, `10s/anuncios.js`, `actual/anuncios.js`, `00s/anuncios.js` — same generation error, contain Spanish pop songs. No audio exists.

**Audio 404 handling:** `audio-manager.js` automatically skips songs with no audio: removes the broken song from the active pool, replaces it with another from the pool, and reloads the question silently. If no replacement is available, it skips the question without penalizing the player. This means "Todas las Décadas" works even for categories with partial audio coverage.

Audio is controlled exclusively through `audio-manager.js`. Calling `stopAudio()` is required when navigating away from a game screen or when the app is hidden (`visibilitychange` event in `main.js`).

### Key Frontend Modules (`public/js/files/`)

| Module | Responsibility |
|---|---|
| `main.js` | Entry point; imports everything; registers on `globalThis` |
| `app-init-functions.js` | App startup, `initializeApp`, session restore |
| `gameplay-core.js` | Local game loop: `selectPlayers`, `startGame`, `nextPlayerOrEndGame`, `endGame` |
| `questions.js` | `setupQuestion`, `checkAnswer`, `updateAttemptsCounter` |
| `audio-manager.js` | `playAudioSnippet`, `stopAudio` |
| `online-functions.js` | Online game API calls; `createOnlineGame`, `pollOnlineGameStatus` |
| `online-invites.js` | Invite polling, invite by username, game codes |
| `online-ui.js` | Render online game history, results |
| `online-notifications.js` | In-app toasts and push notifications for online events |
| `modal-functions.js` | All modals: `showAppAlert`, `showAppConfirm`, legal docs, `openSelectPicker` |
| `navigation-functions.js` | Screen transitions: `exitGame`, `confirmReturnToMenu`, `showAllSongs` |
| `screen-functions.js` | `showScreen(id)` — the single function to switch visible screen |
| `populate-functions.js` | Fills decade/category custom picker buttons (replaces native `<select>`) |
| `payment-functions.js` | Stripe checkout: `redirectToStripe`, `validatePaymentStatus` |
| `premium-functions.js` | `showPremiumModal`, `isPremiumCategory`, `hasCategoryAccess` |
| `logger.js` | Centralized logger with levels ERROR/WARN/INFO/DEBUG. Default: WARN. |

### Custom Select Pickers

Native `<select>` elements are replaced with `<button>` + `<input type="hidden">` pairs to avoid the OS system picker on Android. The shared modal `#select-picker-modal` is opened via `openSelectPicker(fieldId, btnId, title, options)`. Read the hidden input `.value` (not the button text) to get the selected value.

### Online Game Flow

1. Creator: calls `createOnlineGame()` → POST `/api/online-games` → gets a 6-char code.
2. Invitee: joins via code (`joinOnlineGame`) or username invite (`invitePlayerByName`).
3. Both sides: `startOnlineGame()` → calls `setupQuestion(globalThis.nextPlayerOrEndGame)` in a loop.
4. On finish: `submitOnlineScore()` sets the player's score on `#wait-your-score`, then POST `/api/online-games/submit`. If the opponent hasn't finished yet, shows `online-wait-screen` and starts `pollOnlineGameStatus`.
5. `pollOnlineGameStatus` checks `GET /api/online-games/:code` every 3 s. On each tick it calls `updateWaitScreen(players)` to update the opponent's name and status badge (yellow "jugando..." → green "¡Ha terminado!"). When `finished === true`, calls `sendGameFinishedNotification` then `showOnlineResults`.

Email comparisons in online code must always use `.toLowerCase()` on both sides to avoid Android vs desktop case mismatches.

### Payment System (Stripe)

Single product: **€2.99 — desbloquea todo** (`price_1U18xPBesxEarqE5eMvhTLin`, Stripe test mode).

- `PREMIUM_PRICE_ID` is hardcoded in `server.js` just above the `/api/create-checkout-session` route. The frontend sends only `{ email, returnUrl }` — the server always charges the same price, which is safer than trusting a price ID from the client.
- On payment, webhook saves `"premium_all"` to `user.unlocked_sections`. `hasCategoryAccess()` and `hasPremiumAccess()` in `premium-functions.js` both check for `"premium_all"`.
- All API calls in `payment-functions.js` use relative paths (`/api/...`) — no `CANONICAL_PROD_ORIGIN` dependency.
- When going live: create a new product in Stripe **live mode** and update `PREMIUM_PRICE_ID` in `server.js`.

### Service Worker

Cache name is `adivina-cancion-v1.3.2` in `public/sw.js`. When changing static assets that need cache-busting, update this version string.

### Notes

- `spotify_urls.py` in the project root is a one-time utility script — do NOT commit it (contains API credentials).
- The `.gitignore` file has an unresolved merge conflict marker that should be cleaned up.
- Admin email (`vtornet@gmail.com`) is hardcoded in both `server.js` (login bypass) and `public/js/constants/app-constants.js`.
- `CANONICAL_PROD_ORIGIN` is `"https://adivinalacancion.app"` in both `constants.js` and `app-constants.js`. Verify this domain is correctly configured in Railway before relying on it.
- Linux filesystem on Railway is case-sensitive. Audio file paths in JS data files must match the exact casing of the MP3 filenames. Windows local dev is case-insensitive and will mask these bugs.
