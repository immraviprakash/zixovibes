# Zix'Ovibes

> A music + productivity web application combining an immersive local
> music experience with AI-assisted focus planning, Pomodoro execution,
> and contextual music selection.

Zix'Ovibes is built around two intentionally distinct experiences:

-   **Classic Mode** — a retro-inspired music environment centered
    around a vinyl-style player, curated playlists, audio controls,
    favorites, and the AI music companion **Bro**.
-   **Deep Focus Mode** — a productivity workspace that turns
    natural-language goals into structured focus plans, Pomodoro
    sessions, task checklists, and contextual music recommendations.

The application uses a React/Vite frontend deployed on Netlify, an
Express backend intended for deployment on Render, Firebase
Authentication and Firestore, locally bundled music assets, and
Groq-powered AI services. These architectural and feature claims were
independently reviewed against the current implementation.

## ✨ Features

### Classic Mode

Classic Mode is intentionally restricted to six playlists, in this
order:

1.  Lo-Fi
2.  Jazz
3.  Sleep
4.  Relax
5.  Ambience
6.  Rain

Features include:

-   Custom vinyl-style player
-   Circular drag-to-seek interaction
-   Play/pause, previous/next
-   Shuffle and loop
-   Volume and mute controls
-   Playlist and song favorites
-   Recently played state
-   Playlist/song search
-   AI music companion, **Bro**
-   Guest authentication gates for protected actions

The six-playlist restriction and ordering are verified against the
current implementation. fileciteturn14file4

### Deep Focus Mode

Deep Focus is the productivity workspace.

Its six playlists are:

1.  Focus
2.  Lo-Fi
3.  Playlist For You
4.  Ambience
5.  Rain
6.  Jazz

It includes:

-   Natural-language focus planning
-   AI-generated task plans
-   Task classification
-   Manual task creation
-   Pomodoro sessions
-   Pause/resume
-   Five-minute breaks
-   Skip Break
-   Starting Soon / In Progress / Completed states
-   Session completion states
-   Replanning
-   Persistent task/session recovery
-   Contextual **Playlist For You** recommendations

Deep Focus playlist ordering, task states, and Skip Break behavior were
independently verified against the current codebase.
fileciteturn14file4

### AI Music Brain

Deep Focus also uses a local rule-based recommendation engine that
scores the bundled song catalogue against task context.

It considers factors such as:

-   Task category
-   Keyword matches
-   Playlist suitability
-   Song-title signals
-   Artist diversity

The recommendation engine is explicitly rule-based rather than a
machine-learning model. fileciteturn14file14

### Authentication

Authentication uses Firebase Authentication with Firestore-backed
application state.

The flow includes:

-   Login
-   Account creation
-   Username/display-name handling
-   Password validation
-   Confirm-password validation
-   Show/hide password
-   Username reservation/availability handling
-   Logout
-   Guest restrictions
-   Session restoration

The signup flow also includes rollback handling for failed post-signup
operations. fileciteturn14file4

### Audio

The application uses the browser's HTML5 Audio API with locally bundled
music.

Music is organized under:

``` text
public/music/
```

Metadata is stored in:

``` text
public/data/songs.json
public/data/playlists.json
```

Classic and Deep Focus maintain isolated playback state for playlist,
song, elapsed position, shuffle, loop, and playing state, with runtime
guards preventing cross-mode playback leakage. fileciteturn14file8

## 🧠 AI Architecture

The Express backend provides separate AI services for Classic Mode and
Deep Focus.

Deep Focus planning uses Groq's LLM API, with `llama-3.3-70b-versatile`
as the primary model. The backend also implements multi-key failover,
cooldown tracking, and model fallback handling. fileciteturn14file16

The backend API endpoints include:

``` text
POST /api/auth/check-username    — username availability check
POST /api/auth/resolve-username  — resolve username to email (login)
POST /api/auth/reserve-username  — reserve username on signup
POST /api/ai/chat                — Classic Mode AI companion (Bro)
POST /api/ai/df/plan             — Deep Focus planning and replanning
POST /api/ai/history             — fetch conversation history
POST /api/ai/clear               — clear conversation history
GET  /api/health                 — health check
```

## ⏱️ Pomodoro Lifecycle

A completed Pomodoro transitions into a dedicated completion state
instead of remaining at `00:00`.

The lifecycle is:

``` text
In Progress
     ↓
Session Complete
     ↓
 ┌───────────────────────────┐
 │ Take 5 min break          │
 │ OR                        │
 │ Start next session now    │
 └───────────────────────────┘
     ↓
Starting Soon
     ↓
In Progress
```

During a break, the break-specific controls are shown and settings that
could interfere with the break are disabled. The user can skip the break
and immediately continue the next focus session. fileciteturn14file4

## 🏗️ Architecture

Zix'Ovibes is organized as two cooperating processes:

``` text
Zix'Ovibes
├── React + Vite Frontend  [Netlify]
│   ├── Classic Mode
│   ├── Deep Focus Mode
│   ├── AppContext
│   ├── TimerContext
│   └── HTML5 Audio
│
├── Express Backend  [Render — pending deployment]
│   ├── Authentication endpoints
│   ├── Classic AI (Bro)
│   ├── Deep Focus AI + planning
│   ├── Groq client / multi-key failover
│   └── Firebase Admin SDK
│
└── Firebase
    ├── Authentication
    ├── Firestore
    └── Storage
```

The frontend communicates with the backend through a single configurable
API base URL (`VITE_API_URL`). In development this defaults to
`http://localhost:3001`. In production it is set as a Netlify environment
variable pointing to the deployed Render backend service.

### AppContext

`AppContext` is the primary application state layer. It coordinates
authentication, mode switching, playback isolation, favorites,
task/session state, AI playlist generation, and Firestore
synchronization.

### TimerContext

`TimerContext` manages Pomodoro countdowns, break logic, session
completion, task progression, and replanning.

### Mode Isolation

Classic and Deep Focus maintain separate playback state. A runtime
playback guard validates that songs and playlists belong to the active
mode before playback actions execute. fileciteturn14file8

## 🛠️ Tech Stack

  Layer            Technology
  ---------------- ------------------------------
  Frontend         React 19
  Build tool       Vite 8
  Language         JavaScript / ESM
  Styling          CSS Modules + CSS
  Backend          Node.js + Express 5
  Authentication   Firebase Authentication
  Database         Cloud Firestore
  Storage          Firebase Storage
  AI               Groq API
  Audio            HTML5 Audio API
  State            React Context
  Persistence      localStorage + Firestore
  Music            Locally bundled audio assets
  Hosting          Netlify (frontend) · Render (backend)

These technologies were independently verified against `package.json`
and the implementation.

## 📁 Project Structure

``` text
Zix'Ovibes/
├── backend/
│   ├── ai/
│   │   ├── classic/
│   │   ├── deepfocus/
│   │   └── groqClient.js
│   ├── firebaseAdmin.js
│   └── server.js
│
├── public/
│   ├── data/
│   │   ├── playlists.json
│   │   └── songs.json
│   └── music/
│       ├── ambience/
│       ├── focus/
│       ├── jazz/
│       ├── lofi/
│       ├── rain/
│       ├── relax/
│       └── sleep/
│
├── src/
│   ├── components/
│   ├── config/
│   │   └── api.js           ← API base URL (reads VITE_API_URL)
│   ├── context/
│   │   ├── AppContext.jsx
│   │   └── TimerContext.jsx
│   ├── data/
│   │   └── musicBrain.js
│   ├── firebase/
│   ├── App.jsx
│   └── main.jsx
│
├── .env.example             ← frontend env var reference
├── package.json
├── vite.config.js
└── README.md
```

## 🚀 Getting Started

### Prerequisites

-   Node.js 18+
-   npm
-   Firebase project
-   Groq API access for AI features
-   Firebase Admin credentials for backend operations

### Install

``` bash
git clone <repository-url>
cd Zix'Ovibes
npm install
```

### Backend configuration

Create `backend/.env` using `backend/.env.example` as a variable-name
reference. **Never commit real API keys, service-account credentials, or
other secrets.**

Required backend variables (names only — no values here):

``` env
GROQ_API_KEY
GROQ_API_KEY_1
GROQ_API_KEY_2
GROQ_API_KEY_3
GROQ_MODEL
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
ALLOWED_ORIGINS
```

`ALLOWED_ORIGINS` must be set to the deployed frontend URL(s) in
production (comma-separated). The backend defaults to localhost origins
when this variable is absent.

### Frontend configuration

Create a root `.env` file using `.env.example` as a reference (both are
git-ignored).

``` env
VITE_API_URL=http://localhost:3001
```

`VITE_API_URL` is read at build time by Vite. When absent, the
application falls back to `http://localhost:3001`. In production this
variable is set as a Netlify environment variable pointing to the
deployed Render backend.

### Run the backend

``` bash
node backend/server.js
```

### Run the frontend

``` bash
npm run dev
```

Both processes must be running concurrently when using features that
depend on backend services (AI companion, Deep Focus planning,
authentication username handling).

### Production build

``` bash
npm run build
```

### Preview production build

``` bash
npm run preview
```

### Music metadata

``` bash
npm run process-music
```

## 🌐 Deployment

### Live Demo

The frontend is live at:

**<https://zixovibes.netlify.app>**

### Production architecture

``` text
GitHub (immraviprakash/zixovibes)
  ├── → Netlify          React/Vite frontend
  └── → Render           Express backend  [pending deployment]
```

The Netlify frontend communicates with the Render backend through the
`VITE_API_URL` environment variable, which is set in Netlify's
environment settings after the Render service is deployed.

### Frontend — Netlify

The Vite frontend is deployed on Netlify via the `main` branch. No build
command changes are required; Netlify picks up `vite build` from
`package.json`.

Netlify environment variable required for production:

``` text
VITE_API_URL=<Render backend URL>
```

### Backend — Render

Deploy the Express backend as a Render Web Service:

| Setting | Value |
| --- | --- |
| Repository | `immraviprakash/zixovibes` |
| Branch | `main` |
| Root Directory | *(blank)* |
| Build Command | `npm install` |
| Start Command | `node backend/server.js` |

Render environment variables required:

``` text
GROQ_API_KEY
GROQ_API_KEY_1  (optional, failover)
GROQ_API_KEY_2  (optional, failover)
GROQ_API_KEY_3  (optional, failover)
GROQ_MODEL      (optional, defaults to llama-3.3-70b-versatile)
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
ALLOWED_ORIGINS=https://zixovibes.netlify.app
```

Do **not** set `PORT` on Render; it is injected automatically.

## 🔒 Security

-   `.env` files are excluded from Git via `.gitignore`.
-   Firebase Admin service-account JSON files are excluded from Git.
-   Groq API keys and other secrets must not be committed.
-   `backend/.env.example` contains variable names only — no values.
-   Production secrets are configured through the hosting platform's
    environment-variable system (Render for the backend, Netlify for the
    frontend).
-   Review Firebase Authentication and Firestore security rules before
    opening the repository to the public.

**Note on the Firebase web configuration:** the `firebase.js` client
configuration (API key, project ID, etc.) is the standard client-side
Firebase config intended for browser use. It is not a server secret and
does not bypass Firebase security rules. Access control is enforced by
Firebase Authentication and Firestore rules.

## 💾 Persistence

Zix'Ovibes combines:

-   React Context state
-   localStorage
-   Firestore
-   runtime audio state

The application uses debounced Firestore synchronization and periodic
checkpoints for selected persistent state. The reviewed implementation
uses a four-second debounce and a 45-second checkpoint interval.
fileciteturn14file3

Temporary Deep Focus state such as **Playlist For You** follows a
separate lifecycle from permanent playlists and is cleaned according to
the focus-session/favorite state rules implemented by the application.

## 🎼 Music Assets

The bundled music catalogue lives under:

``` text
public/music/
```

The repository's `.gitignore` does not contain a general MP3/audio
exclusion rule, so music assets are eligible to be tracked by Git.

If music is redistributed, verify that the appropriate rights or
licenses exist for every track.

## ♿ Accessibility & Interaction

The application includes accessibility-oriented interaction patterns
such as:

-   ARIA announcements
-   `aria-busy` states
-   Keyboard interaction
-   Escape-key navigation
-   Keyboard-accessible controls

The global Escape behavior follows a priority model in Deep Focus:

``` text
ESC
 ↓
Focus Planner open?
 ├─ YES → close planner
 │
 └─ NO
      ↓
Playlist/detail view open?
 ├─ YES → return to dashboard
 │
 └─ NO
      ↓
Do nothing
```

The independent audit identified these accessibility and keyboard
behaviors as worthwhile portfolio-level implementation details.
fileciteturn14file14

## ⚠️ Current Limitations

This is a portfolio-scale application rather than a production SaaS
platform.

Known limitations include:

-   Backend API URL (`VITE_API_URL`) must be set in Netlify's environment
    settings once the Render backend is deployed; AI and auth features
    will not function in production until that step is complete.
-   The central `AppContext` has grown large and could eventually be
    decomposed into smaller domain-specific contexts/hooks.
-   Browser timer scheduling can be affected by background-tab
    throttling.
-   Large locally bundled music libraries increase repository and
    deployment size.
-   AI features depend on the configured Groq service and its usage
    limits.
-   Production deployment would benefit from stronger automated testing,
    observability, and CI.

These limitations are consistent with the independent technical review,
which found no major factual problems with the application's documented
architecture. fileciteturn14file3

## 🔮 Future Improvements

Potential future work:

-   Stricter CORS policy per deployment environment
-   Further state-layer decomposition
-   Dedicated object storage/CDN for large audio libraries
-   Automated test coverage and CI
-   Production observability
-   Stronger deployment automation
-   Expanded accessibility testing
-   More advanced recommendation models

## 🧪 Project Status

**Zix'Ovibes is currently at the portfolio-ready stage.**

The application has undergone end-to-end manual QA covering
authentication, Classic Mode playback, Deep Focus planning, Pomodoro
lifecycle, break handling, mode switching, audio synchronization,
seeking, favorites, playlist lifecycle, refresh recovery, Escape-key
navigation, volume control, and Classic/Deep Focus playlist isolation.

The independent README review found the documentation technically
credible and suitable for a professional developer portfolio, with only
minor corrections recommended. fileciteturn14file7

## 📄 License

No open-source license is asserted unless a `LICENSE` file is present in
the repository.

If the project is intended to be distributed as open source, add an
explicit license.

------------------------------------------------------------------------

**Zix'Ovibes — Music for the flow. Productivity for the focus.**
