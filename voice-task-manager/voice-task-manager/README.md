# Voice-Controlled Task Manager

Speak a command, get a task. A full-stack **MERN** app that streams microphone audio over **WebSocket (Socket.io)** to a Node server, transcribes it live with **Deepgram**, turns the transcript into a structured action with an **OpenAI** intent parser, and updates MongoDB, with every connected tab updating in real time.

> "add call the bank tomorrow at 11" / "move gym to Friday evening" / "mark the dentist one done" / "what's due today"

## Architecture

```
Browser (React)                         Node / Express                         External
┌──────────────────┐   audio chunks    ┌──────────────────────┐   stream     ┌──────────┐
│ MediaRecorder    │ ───Socket.io────▶ │ transcriber.js       │ ───────────▶ │ Deepgram │
│ push-to-talk     │                   │   live STT session   │ ◀─────────── │  nova-2  │
│                  │ ◀── interim text ─│                      │  transcript  └──────────┘
│ Task list        │                   │ intentParser.js      │ ───────────▶ ┌──────────┐
│ (REST + sockets) │ ◀── result/timing │   LLM -> JSON action │ ◀─────────── │  OpenAI  │
└──────────────────┘                   │ voiceCommand.js      │              └──────────┘
        ▲  tasks:changed               │   resolve + execute  │ ───────────▶ ┌──────────┐
        └──────────────────────────────│ taskService.js       │              │ MongoDB  │
                                       └──────────────────────┘              └──────────┘
```

**Pipeline per command:** speech-to-text, then LLM intent parsing, then target resolution, then database action. The server reports a timing breakdown (`sttMs`, `llmMs`, `actionMs`, `totalMs`) with every result, and the UI shows it, so you can quote a real end-to-end latency.

### Design decisions worth explaining in interviews
- **The LLM never touches the database.** It only emits JSON that is validated with Zod; the server resolves which task is meant and performs the action. A bad model response becomes `unknown`, never a bad write.
- **Ambiguity asks instead of guessing.** "Delete the email task" with two matches returns a `clarify` result and the UI asks which one. Nothing is deleted until the user picks.
- **Low-confidence transcripts are confirmed first.** Below `MIN_CONFIDENCE` the user can edit the transcript before anything runs.
- **Timezones are handled server-side.** The LLM outputs local wall-clock time; the server converts it using the browser's timezone, so "tomorrow at 5" means 5 pm for the user.
- **Typed fallback** uses the same pipeline minus speech-to-text.
- **Reconnects and heartbeats:** Socket.io ping/pong (10 s) detects dead connections, the client auto-reconnects and re-syncs tasks on `connect`, and the status dot shows connection state.
- **Multi-tab sync:** each user joins a room; mutations broadcast `tasks:changed`. To scale to multiple servers, add the Socket.io Redis adapter and sticky sessions.

### Socket events
| Direction | Event | Payload |
|---|---|---|
| client to server | `voice:start` | `{ timezone }` |
| client to server | `voice:audio` | binary chunk (250 ms) |
| client to server | `voice:stop` | none |
| client to server | `voice:text` | `{ text, timezone }` (typed fallback) |
| client to server | `voice:select` | `{ taskId }` (answer to "which one?") |
| server to client | `voice:interim` | `{ transcript }` |
| server to client | `voice:result` | `{ transcript, intent, result, timings }` |
| server to client | `voice:lowconfidence` | `{ transcript, confidence }` |
| server to client | `voice:error` | `{ message }` |
| server to client | `tasks:changed` | none (broadcast to the user's tabs) |

## Run locally

Requirements: Node 18+, MongoDB (local or Atlas), an [OpenAI](https://platform.openai.com) key, a [Deepgram](https://deepgram.com) key.

```bash
# 1. API + WebSocket server
cd server
cp .env.example .env        # fill in MONGODB_URI, JWT_SECRET, OPENAI_API_KEY, DEEPGRAM_API_KEY
npm install
npm run dev                 # http://localhost:5000

# 2. Client (new terminal)
cd client
npm install
npm run dev                 # http://localhost:5173
```

Open http://localhost:5173, create an account, then **hold the mic button** and speak. Browsers only allow microphone access on `localhost` or HTTPS.

## Tests and metrics

```bash
cd server
npm test                    # Jest + Supertest, in-memory MongoDB (downloads a mongod binary on first run)
npm run eval:intents        # needs OPENAI_API_KEY; prints intent accuracy over 20 labelled utterances
```

Tests cover auth, task CRUD and per-user isolation, request validation, the intent parser (with a mocked LLM), timezone conversion, and voice-command execution including ambiguity handling. CI runs them on every push (`.github/workflows/ci.yml`).

Fill in your resume numbers from real measurements:
- **Latency:** the `totalMs` shown under the mic after each command. Average 10 or more runs.
- **Accuracy:** the percentage printed by `npm run eval:intents`. Add your own utterances to `server/scripts/eval-intents.js` to grow N.
- **Test count:** the total printed by `npm test`.

## API

| Method | Route | Notes |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | returns `{ token, user }` |
| GET | `/api/auth/me` | requires `Authorization: Bearer <token>` |
| GET | `/api/tasks?status=todo\|done` | current user's tasks |
| POST | `/api/tasks` | `{ title, dueDate?, priority? }` |
| PATCH | `/api/tasks/:id` | partial update |
| DELETE | `/api/tasks/:id` | 204 |

Security: bcrypt password hashing, JWT auth (REST and WebSocket handshake), Zod validation, Helmet, CORS allow-list, REST rate limits (100/min; 20 per 15 min on auth), a per-socket cap of 30 voice commands per minute, and task queries always scoped to the authenticated user.

## Deploy
- **Database:** MongoDB Atlas, then set `MONGODB_URI`.
- **Server:** Render, Railway, or AWS EC2 (needs WebSocket support). Set the env vars from `.env.example` and `CLIENT_ORIGIN` to your client URL. Start command: `npm start`.
- **Client:** Vercel or Netlify. Set `VITE_SERVER_URL` to the server URL and build with `npm run build`.

## Ideas to extend
Refresh tokens, a Redis adapter for multi-instance Socket.io, text-to-speech replies, barge-in, recurring tasks, and a Playwright end-to-end test.
