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
- `espanol.js` and `ingles.js` for `80s`, `90s`, `00s` have real Spotify URLs. The same files for `10s` and `actual` still have placeholder strings (`URL_PENDIENTE_...`) — pending a Spotify API rate-limit reset before the script can finish.

### Decades and Categories

Defined in `public/app_info/app-info.js` and `public/js/constants/app-constants.js`.

- **Decades**: `80s`, `90s`, `00s`, `10s`, `actual`, `verano`, `Todas` (all), `elderly`
- **Categories**: `espanol`, `ingles`, `peliculas`, `series`, `tv`, `infantiles`, `anuncios`, `consolidated`
- **Premium categories** (require payment): `peliculas`, `series`, `tv`, `infantiles`, `anuncios`
- **Premium decades**: `Todas`, `verano`

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

### Audio

MP3 files live in `public/audio/[decade]/[category]/`. All files are normalized to **-14 LUFS** (EBU R128). SFX files are in `public/audio/sfx/` and are excluded from normalization.

Audio is controlled exclusively through `audio-manager.js`. Calling `stopAudio()` is required when navigating away from a game screen or when the app is hidden (`visibilitychange` event in `main.js`).

### Service Worker

Cache name is `adivina-cancion-v1.3.1` in `public/sw.js`. When changing static assets that need cache-busting, update this version string.

### Notes

- `spotify_urls.py` in the project root is a one-time utility script — do NOT commit it (contains API credentials).
- The `.gitignore` file has an unresolved merge conflict marker that should be cleaned up.
- Admin email (`vtornet@gmail.com`) is hardcoded in both `server.js` (login bypass) and `public/js/constants/app-constants.js`.
