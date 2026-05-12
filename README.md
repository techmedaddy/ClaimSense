# ClaimSense — Autonomous Insurance Claims Platform

ClaimSense is a production-oriented, AI-augmented claims processing platform that automates the full lifecycle of a First Notice of Loss (FNOL) document — from raw file ingestion through structured data extraction, deterministic business-rule evaluation, and final queue routing. The system is designed around a strict separation between probabilistic inference (AI) and deterministic decision-making (rules engine), ensuring regulatory auditability without sacrificing processing throughput.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Data Flow](#data-flow)
4. [Engineering Deep-Dives](#engineering-deep-dives)
   - [Rate Limiting — Sliding Window Algorithm](#rate-limiting--sliding-window-algorithm)
   - [Claims Routing Engine — Deterministic Priority Rules](#claims-routing-engine--deterministic-priority-rules)
   - [Frontend State Persistence — Client-Side Storage](#frontend-state-persistence--client-side-storage)
   - [Client-Side Hash Router](#client-side-hash-router)
5. [Tech Stack](#tech-stack)
6. [Running Locally](#running-locally)
7. [Deployment](#deployment)

---

## System Overview

The core design principle of ClaimSense is **AI for extraction, rules for decisions**. Large language models are excellent at reading unstructured prose and mapping it to structured schemas. They are poor at consistently applying hard business rules. ClaimSense deliberately keeps these two concerns decoupled:

- The **Extraction Agent** uses an LLM (MiniMax-M2.7 via NVIDIA NIM) to parse FNOL documents into a typed Pydantic schema.
- The **Routing Engine** consumes that validated schema and applies a pure-Python deterministic rule cascade to assign a queue — with zero AI involvement at this stage.

This makes every routing decision fully traceable, reproducible, and auditable, which is a non-negotiable requirement in regulated domains like insurance.

---

## High-Level Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                          CLIENT BROWSER                           │
│                                                                   │
│  ┌─────────────────┐    Hash Router (#/dashboard, #/upload,      │
│  │   Vanilla SPA   │◄── #/queue/MANUAL_REVIEW, etc.)             │
│  │  HTML/CSS/JS    │                                              │
│  │                 │    localStorage ──► claimsense_claims[]      │
│  └────────┬────────┘                                              │
│           │ HTTP / FormData (multipart)                           │
└───────────┼───────────────────────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────────────────────────────────┐
│                      FASTAPI APPLICATION LAYER                    │
│                                                                   │
│  ┌─────────────────────────────────┐                             │
│  │   Sliding-Window Rate Limiter   │  (ASGI Middleware)          │
│  │   /api/process  → 5  req/min    │                             │
│  │   /*            → 30 req/min    │                             │
│  └────────────────┬────────────────┘                             │
│                   │ pass-through                                  │
│  ┌────────────────▼────────────────┐                             │
│  │         POST /api/process       │                             │
│  └────────────────┬────────────────┘                             │
│                   │                                               │
│     ┌─────────────▼──────────────┐                               │
│     │     Document Parser        │  pdfplumber / plain-text      │
│     └─────────────┬──────────────┘                               │
│                   │ raw_text                                      │
│     ┌─────────────▼──────────────┐                               │
│     │     Extraction Agent       │  LLM + Pydantic schema        │
│     └─────────────┬──────────────┘                               │
│                   │ ExtractionResultSchema                        │
│     ┌─────────────▼──────────────┐                               │
│     │      Routing Engine        │  Deterministic rule cascade   │
│     └─────────────┬──────────────┘                               │
│                   │ FinalOutputSchema (JSON)                      │
└───────────────────┼───────────────────────────────────────────────┘
                    │
                    ▼
            HTTP 200 → Client SPA
```

---

## Data Flow

```
  ┌──────────┐    upload     ┌──────────────┐   raw text   ┌───────────────┐
  │  Browser │──────────────►│   FastAPI    │─────────────►│ DocumentParser│
  └──────────┘               └──────────────┘              └──────┬────────┘
                                                                   │
                                                           ┌───────▼────────┐
                                                           │ExtractionAgent │
                                                           │  (LLM + NIM)   │
                                                           └───────┬────────┘
                                                                   │ JSON + Pydantic
                                                           ┌───────▼────────┐
                                                           │ RoutingEngine  │
                                                           │  (Rule Cascade)│
                                                           └───────┬────────┘
                                                                   │ FinalOutputSchema
                                              ┌────────────────────▼──────────────────┐
                                              │           Browser SPA                 │
                                              │  • Renders claim in table             │
                                              │  • Updates sidebar queue counters     │
                                              │  • Persists to localStorage           │
                                              │  • Navigates to #/dashboard           │
                                              └───────────────────────────────────────┘
```

---

## Engineering Deep-Dives

### Rate Limiting — Sliding Window Algorithm

#### Problem
Naïve IP-level rate limiting using fixed time windows (e.g., "reset counter at the top of each minute") suffers from boundary bursts — a client can fire `N` requests at 00:59 and another `N` at 01:00, effectively doubling the intended limit in a 2-second window.

#### Implementation
ClaimSense implements a **sliding-window counter** as a pure-Python ASGI middleware, with no external dependencies (no Redis, no additional libraries). The middleware maintains a per-IP deque of UTC timestamps for each incoming request. On every subsequent request, it first prunes all timestamps older than the window duration before evaluating the count:

```python
# Pseudo-code of the sliding window evaluation
now = time.time()
window = deque(t for t in request_history[ip] if now - t < WINDOW_SECONDS)
if len(window) >= MAX_REQUESTS:
    raise HTTP 429 (Too Many Requests)
else:
    window.append(now)
    request_history[ip] = window
```

The window "slides" with the current timestamp rather than resetting at a fixed clock boundary, eliminating the burst vulnerability entirely.

#### Limits Applied

| Endpoint      | Limit       | Rationale                                                       |
|---------------|-------------|-----------------------------------------------------------------|
| `POST /api/process` | **5 req/min** | Each request makes an external LLM API call; cost and abuse protection |
| `GET /*` (UI) | **30 req/min** | Prevents DDoS/scraping of the static frontend                   |

Standard compliance headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`) are injected on every response so clients can implement intelligent backoff.

---

### Claims Routing Engine — Deterministic Priority Rules

#### Problem
Insurance claim routing cannot rely on AI inference alone. LLMs are non-deterministic by nature — the same input can occasionally yield a different confidence score or phrasing on subsequent calls. In regulated environments, every routing decision must be reproducible, explainable, and auditable.

#### Implementation
The `RoutingEngine` (`services/routing_engine.py`) is a pure-Python class that consumes the validated `ExtractionResultSchema` and evaluates a **cascading priority chain**. Rules are evaluated sequentially; the first matching rule short-circuits the rest, preventing conflicting signals from producing ambiguous outcomes.

```
Priority Chain (highest → lowest):

1. DATA COMPLETENESS CHECK  ──►  MANUAL_REVIEW
   Condition: missingMandatoryFields[] is non-empty
   Rationale: A claim cannot be processed, approved, or investigated
              without complete data. Human must collect missing fields
              before any further action.

2. FRAUD SIGNAL DETECTION   ──►  INVESTIGATION
   Condition: Incident description contains trigger lexicon
              {"fraud", "staged", "suspicious", "deliberate",
               "unclear", "inconsistent"}
   Rationale: Keyword presence warrants SIU referral before
              any payment processing begins.

3. BODILY INJURY TRIAGE     ──►  SPECIALIST_QUEUE
   Condition: Any involvedParty.injuries is non-null / non-empty
   Rationale: BI claims involve medical billing, tort liability,
              and potential litigation requiring a senior adjuster.

4. FINANCIAL THRESHOLD      ──►  FAST_TRACK
   Condition: initialEstimate < $25,000 AND all above pass
   Rationale: Low-complexity, property-damage-only claims below
              the threshold can be approved via STP (Straight-
              Through Processing) without adjuster intervention.

5. DEFAULT FALLBACK         ──►  MANUAL_REVIEW
   Condition: None of the above matched (high-value, complete claim)
   Rationale: Claims exceeding the STP threshold require manual
              damage assessment before approval.
```

The routing result is always accompanied by a `reasoning` field — a human-readable sentence explaining exactly which rule triggered and why, providing a complete audit trail.

---

### Frontend State Persistence — Client-Side Storage

#### Problem
The initial implementation used an in-memory JavaScript array (`claims[]`) scoped to the page lifecycle. Any browser refresh, tab closure, or navigation event caused complete state loss — unacceptable for a demo environment where accumulated results need to persist across sessions.

#### Decision: `localStorage` vs. Backend Database

For the current POC scope, introducing a persistent database (PostgreSQL, SQLite) would require:
- Schema migrations
- A separate persistence service layer
- Additional infrastructure in the deployment environment

A backend database remains the correct long-term solution. However, for the purpose of session persistence in a single-user demonstration context, the browser's **`localStorage` API** provides an equivalent user experience with zero infrastructure overhead.

#### Implementation

All processed claims are serialized to JSON and written to `localStorage` under the key `claimsense_claims` immediately after every successful API response:

```javascript
// Write path (after each successful /api/process call)
localStorage.setItem('claimsense_claims', JSON.stringify(claims));

// Read path (on page load / DOMContentLoaded)
const stored = localStorage.getItem('claimsense_claims');
if (stored) {
    claims = JSON.parse(stored);
    claimCounter = claims.length; // restore auto-increment ID sequence
}
```

On initial page load, the application hydrates its in-memory state from `localStorage` before rendering, making the dashboard feel stateful even after a hard refresh. The counter is also restored from the length of the persisted array, ensuring monotonically increasing Claim IDs (`CLM-2025-0001`, `CLM-2025-0002`, ...) without gaps or collisions across sessions.

#### Tradeoffs

| Property | localStorage | SQLite Backend |
|---|---|---|
| Setup complexity | None | Migration + ORM setup |
| Cross-device sync | ❌ No | ✅ Yes |
| Data durability | Browser-scoped | Persistent on disk |
| Suitable for POC demo | ✅ Yes | Overkill |
| Suitable for production | ❌ No | ✅ Yes |

---

### Client-Side Hash Router

The SPA uses a native **hash-based routing** strategy — zero libraries, zero build step. The URL fragment (the part after `#`) is used as the navigation state machine:

| URL Fragment | View Rendered | Filter Applied |
|---|---|---|
| `#/dashboard` | Claims table | None (all claims) |
| `#/upload` | FNOL upload panel | — |
| `#/queue/FAST_TRACK` | Claims table | Route = FAST_TRACK |
| `#/queue/MANUAL_REVIEW` | Claims table | Route = MANUAL_REVIEW |
| `#/queue/INVESTIGATION` | Claims table | Route = INVESTIGATION |
| `#/queue/SPECIALIST` | Claims table | Route = SPECIALIST |

The router listens to `window.addEventListener('hashchange', handleRouteChange)`. On every URL change, `handleRouteChange()` parses the fragment, sets the active panel, applies the queue filter to the rendered table, and updates the sidebar highlight state. All navigation — including sidebar links, top-bar buttons, and the post-upload redirect — simply mutates `window.location.hash`, letting the router handle all rendering logic from a single source of truth.

This approach also makes every view **deep-linkable and bookmarkable**. A shared URL of `http://yourdomain.com/#/queue/MANUAL_REVIEW` will load the dashboard pre-filtered to the Manual Review queue with persisted claims intact.

---

## Tech Stack

| Layer | Technology |
|---|---|
| HTTP Server | FastAPI + Uvicorn |
| Production Server | Gunicorn (uvicorn workers) |
| AI Inference | MiniMax-M2.7 via NVIDIA NIM (OpenAI-compatible) |
| Schema Validation | Pydantic V2 |
| PDF Parsing | pdfplumber |
| Frontend | Vanilla HTML5 / CSS3 / ES6+ (zero build pipeline) |
| State Persistence | Browser `localStorage` |
| Deployment | Render (render.yaml blueprint) |

---

## Running Locally

```bash
# 1. Clone and set up environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 2. Configure credentials
cp .env.example .env
# Edit .env: NVIDIA_API_KEY=nvapi-your-key-here

# 3. Start development server
python app.py

# 4. Start production server
gunicorn app:app --workers 2 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

Navigate to `http://localhost:8000` — the `static/samples/` directory contains three pre-built test documents (complete, partial, and empty FNOL forms) for immediate end-to-end testing without a real claim file.

---

## Deployment

This project ships with a `render.yaml` blueprint for zero-configuration deployment to [Render](https://render.com):

1. Push to GitHub
2. Render Dashboard → **New** → **Blueprint** → connect repo
3. Add `NVIDIA_API_KEY` in the Render environment variables panel
4. Deploy

Manual deployment configuration:
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `gunicorn app:app --workers 2 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT`
