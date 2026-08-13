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

The application uses a React/Vite frontend, an Express backend, Firebase
Authentication and Firestore, locally bundled music assets, and
Groq-powered AI services. These architectural and feature claims were
independently reviewed against the current implementation.
fileciteturn14file4

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

The major backend endpoints include:

``` text
/api/auth/*
/api/ai/chat
/api/ai/df/plan
```

Supporting AI history and health endpoints are also present in the
backend. fileciteturn14file11

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
├── React + Vite Frontend
│   ├── Classic Mode
│   ├── Deep Focus Mode
│   ├── AppContext
│   ├── TimerContext
│   └── HTML5 Audio
│
├── Express Backend
│   ├── Authentication
│   ├── Classic AI
│   ├── Deep Focus AI
│   └── Groq client/failover
│
└── Firebase
    ├── Authentication
    └── Firestore
```

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
  AI               Groq API
  Audio            HTML5 Audio API
  State            React Context
  Persistence      localStorage + Firestore
  Music            Locally bundled audio assets

These technologies were independently verified against `package.json`
and the implementation. fileciteturn14file0

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
│   ├── context/
│   │   ├── AppContext.jsx
│   │   └── TimerContext.jsx
│   ├── data/
│   │   └── musicBrain.js
│   ├── firebase/
│   ├── services/
│   ├── App.jsx
│   └── main.jsx
│
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

Create:

``` text
backend/.env
```

Use `backend/.env.example` only as a variable-name reference.

**Never commit real API keys, service-account credentials, or other
secrets.**

Example:

``` env
GROQ_API_KEY=your_groq_api_key
GROQ_API_KEY_1=optional_secondary_key
GROQ_API_KEY_2=optional_secondary_key
GROQ_API_KEY_3=optional_secondary_key
```

Provide Firebase Admin credentials using the backend's supported secure
configuration.

### Run the backend

``` bash
node backend/server.js
```

### Run the frontend

``` bash
npm run dev
```

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

The application has two deployable pieces:

### Frontend

The Vite frontend can be deployed to a static hosting platform such as
Netlify, Vercel, Cloudflare Pages, or Firebase Hosting.

### Backend

The Express backend requires a Node.js-capable host such as Railway,
Render, Fly.io, or a VPS.

Before deployment, replace development backend references to:

``` text
http://localhost:3001
```

The current implementation contains backend references in frontend
state/components including:

``` text
AppContext.jsx
TimerContext.jsx
MoodInput.jsx
FocusOnboarding.jsx
```

`TimerContext.jsx` is important because it contains the Deep Focus
replanning request; omitting it can leave replanning pointed at the
local development server. fileciteturn14file9

For a future production architecture, these URLs should be moved into
environment-based configuration.

## 🔒 Security

Before making the repository public:

-   Keep `.env` files ignored.
-   Never commit Firebase Admin service-account JSON.
-   Never commit Groq API keys.
-   Keep `backend/.env.example` limited to placeholders.
-   Review Firebase Authentication and Firestore security rules.
-   Replace hardcoded development backend URLs before deployment.

**Important:** the independent README audit identified real-looking Groq
keys in the existing `backend/.env.example`. Those credentials should be
removed/revoked before a public GitHub push. fileciteturn14file13

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

-   Some backend URLs remain hardcoded and should be environment-driven
    for production.
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

-   Environment-based API configuration
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
