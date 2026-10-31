# 🏛️ Campus Pulse — Module 7: Calendar

**Campus Pulse** is a Smart Campus Information Hub designed for the **Moradabad Institute of Technology (MIT Moradabad)**.

This repository now includes **Module 7 (Calendar)**: a responsive monthly calendar of **student-verified** campus events placed on their confirmed dates. Only records confirmed through the Module 5 verification flow and carrying a valid confirmed date are exposed. Unverified AI extraction output is never used.

Module 6 (Organized View) remains available as a searchable, category-filterable list of all verified notices, including verified notices that have no confirmed date.

Previous modules remain in place: foundation, MIT student authentication, smart notice intake, Gemini AI extraction, student verification/confirmation, and the Organized View.

---

## 📅 Module 7 — Calendar Rules

- **Verified records only.** The calendar uses `status === 'VERIFIED'` records and reads `verifiedData.date`, never the AI-generated date.
- **Confirmed dates only.** Records without a confirmed valid `YYYY-MM-DD` date are excluded from the calendar and remain visible in the Organized View.
- **Monthly view.** The heading shows the current month and year; previous/next controls move one month at a time.
- **Correct calendar math.** Days per month, leap years, and Sunday-based weekday alignment are computed on the server with UTC date parts.
- **Timezone-safe dates.** Event dates stay plain `YYYY-MM-DD` strings end to end; the client never parses them as UTC midnight, so events cannot shift a day.
- **Multiple events per day** are supported. Up to two titles are shown on larger screens; mobile shows a dot and event count. Selecting a date shows full details.
- **Missing optional fields** are rendered as **"Not specified"**; nothing is invented.
- **No hardcoded events.** Everything comes from the existing in-memory notice store; no new tables or duplicate records are created.

---

## 🔎 Module 6 — Organized View Rules

- **Verified records only.** The API filters on `status === 'VERIFIED'` and returns only student-confirmed fields.
- **Search** matches notice title, original notice text (when present), and venue.
- Search is **case-insensitive**, ignores leading/trailing whitespace, and treats all input as literal text (no AI, regex, or query injection).
- **Category filter** supports only the existing categories: Academic, Technical, Cultural, Sports, Workshop, Seminar, Examination, Placement, General.
- Search and category filters combine. A clear-filters control resets both.
- Missing optional fields are rendered as **"Not specified"**.
- No fake or hardcoded events are used. Results come from the existing notice store.

---

## 📁 Project Structure

```
campus-pulse/
  public/
    index.html              # Responsive shell with student sign-in, Smart Input, and AI Extraction UI
    css/
      style.css             # Mobile-first stylesheet (extracted fields grid, comparison panel, status banners)
    js/
      app.js                # Vanilla JavaScript client (auth, notice intake, AI extraction execution)
  src/
    server.js               # Express server with security headers, cookies, and route mounting
    middleware/
      auth.middleware.js    # requireAuth middleware protecting restricted API endpoints
    routes/
      auth.routes.js        # POST /login, POST /logout, GET /me
      extraction.routes.js  # POST /api/extract (Module 4)
      health.routes.js      # GET /api/health (public operational check)
      notice.routes.js      # POST /input, GET /input, GET /input/:id (Module 3)
      organized.routes.js   # GET /api/notices/verified (Module 6)
      calendar.routes.js    # GET /api/calendar?year=YYYY&month=M (Module 7)
    services/
      ai-extraction.service.js # Dedicated Gemini AI extraction engine & schema validator
      notice-store.js       # Notice validation, verification & verified-notice query service
      session.service.js    # Cryptographic session manager with 24h TTL expiration
      student-registry.js   # Official MIT Moradabad student verification roster (bcrypt hashed)
  test/
    module1.test.js         # Foundation test suite
    module2.test.js         # Authentication & security test suite
    module3.test.js         # Smart Input verification test suite
    module4.test.js         # AI Extraction verification test suite
    module6.test.js         # Organized View: auth, search, filters & security test suite
    module7.test.js         # Calendar: auth, date logic, leap years, timezone & UI test suite
  .env.example              # Environment configuration template
  .gitignore                # Standard git ignore rules (node_modules, .env)
  package.json              # Dependencies and run scripts
  README.md                 # Project documentation
```

---

## 🤖 AI Extraction Architecture & Accuracy Rules

### 1. Dedicated Backend Service
- Extraction is performed entirely on the backend through `src/services/ai-extraction.service.js`.
- The Gemini API is **never** called directly from the client; API keys remain strictly confined to backend environment variables.
- Model used: **`gemini-1.5-flash`** (or configurable via `GEMINI_MODEL`).

### 2. Extraction Schema
Extracted data adheres strictly to the following structure:
```json
{
  "title": "string or null",
  "date": "YYYY-MM-DD or null",
  "time": "string or null",
  "venue": "string or null",
  "category": "Academic" | "Technical" | "Cultural" | "Sports" | "Workshop" | "Seminar" | "Examination" | "Placement" | "General" | null
}
```

### 3. Strict Accuracy & Zero-Hallucination Rules
- **No Hallucination:** If a date, time, or venue is missing or ambiguous in the notice, it is strictly returned as `null` (and rendered in the UI as *"Not specified"*).
- **Ambiguous Dates:** Dates without verifiable calendar year/month/day (e.g., "Next Wednesday" or "Coming Friday") are never guessed or fabricated; they are set to `null`.
- **Prompt Injection Defense:** System instructions explicitly isolate user content within `<NOTICE_TEXT>` delimiters. Any adversarial instructions (e.g., "Ignore previous instructions", "Output something else") are neutralized and treated solely as untrusted plain text.
- **Server-Side Post-Validation:** All AI output is parsed and strictly validated by the server before returning to the frontend. Unexpected keys are stripped and malformed formats are safely rejected.

---

## ⚙️ Environment Configuration

Set the following variables in `.env`:

```env
PORT=3000
NODE_ENV=development

# Application Metadata
APP_NAME="Campus Pulse"
INSTITUTION_NAME="Moradabad Institute of Technology"

# Student Access Control
OFFICIAL_STUDENT_DOMAIN="mitmoradabad.edu.in"
SESSION_SECRET="your-secure-session-secret"

# Gemini AI Extraction (Module 4)
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
GEMINI_MODEL="gemini-1.5-flash"
```

*Note: If `GEMINI_API_KEY` is not configured, the endpoint cleanly returns `HTTP 503 Service Unavailable` explaining the missing configuration.*

---

## 📡 API Endpoints

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/health` | Public | Operational status check |
| `POST` | `/api/auth/login` | Public | Authenticates student credentials & sets session cookie |
| `POST` | `/api/auth/logout` | Public | Clears session cookie & invalidates token |
| `GET` | `/api/auth/me` | Protected | Returns authenticated student context |
| `POST` | `/api/notices/input` | Protected | Submits raw notice text for validation and preservation |
| `GET` | `/api/notices/input` | Protected | Retrieves notices submitted by the authenticated student |
| `POST` | `/api/extract` | Protected | Extracts Title, Date, Time, Venue, and Category using Gemini AI |
| `GET` | `/api/notices/verified` | Protected | Returns student-verified notices with optional `search` and `category` filters (Module 6) |
| `GET` | `/api/calendar` | Protected | Returns verified events for a month with calendar metadata (Module 7) |

### GET `/api/notices/verified`

- **Auth:** authenticated MIT Moradabad student session required (`401` otherwise).
- **Query parameters:**
  - `search` — optional, max 120 characters; matches title, original notice text, and venue.
  - `category` — optional, one of the nine supported categories (case-insensitive).
- **Validation:** unsupported categories, oversized search terms, and repeated query parameters return `400`.
- **Response shape:**
```json
{
  "success": true,
  "count": 1,
  "filters": { "search": "workshop", "category": "Workshop" },
  "supportedCategories": ["Academic", "Technical", "Cultural", "Sports", "Workshop", "Seminar", "Examination", "Placement", "General"],
  "notices": [
    {
      "id": "notice-...",
      "title": "...",
      "date": "YYYY-MM-DD",
      "time": "...",
      "venue": "...",
      "category": "Workshop",
      "verifiedAt": "..."
    }
  ]
}
```
- **Privacy:** does not return submitter/verifier identity, email addresses, roll numbers, raw AI output, or internal record metadata.
- **Errors:** structured JSON only; internal store errors are replaced with a generic `500` message.

### GET `/api/calendar`

- **Auth:** authenticated MIT Moradabad student session required (`401` otherwise).
- **Query parameters:**
  - `year` — optional, four digits, `1900`–`2100`. Defaults to the server's current year.
  - `month` — optional, `1`–`12`. Defaults to the server's current month.
- **Validation:** non-numeric/out-of-range values, empty values, and repeated `year`/`month` parameters return `400`.
- **Response shape:**
```json
{
  "success": true,
  "year": 2026,
  "month": 12,
  "monthLabel": "December 2026",
  "daysInMonth": 31,
  "firstWeekday": 2,
  "count": 1,
  "events": [
    {
      "id": "notice-...",
      "title": "...",
      "date": "2026-12-15",
      "time": "10:00 AM",
      "venue": "Main Auditorium",
      "category": "Technical"
    }
  ]
}
```
- **Notes:**
  - `firstWeekday` is Sunday-based (`0` = Sunday, `6` = Saturday).
  - `daysInMonth` and `firstWeekday` are computed with UTC date parts, so they are timezone-independent.
  - `time` and `venue` are `null` when not confirmed.
  - Events are sorted by date, then time, then title, and de-duplicated by notice ID.
- **Privacy:** returns only calendar fields; no student identity, raw text, AI output, or internal metadata.
- **Errors:** structured JSON only; internal errors are replaced with a generic `500` message.

---

## 🔑 Authorized Student Test Credentials

| Student Name | Roll / Student ID | Branch | Official Institutional Email | Password |
|---|---|---|---|---|
| **Rohit Sharma** | `2200820100045` | Computer Science & Eng. | `rohit.cse22@mitmoradabad.edu.in` | `MitStudent@2026` |
| **Priya Verma** | `2200820140028` | Electronics & Comm. Eng. | `priya.ece22@mitmoradabad.edu.in` | `MitStudent@2026` |

---

## 🚀 Running the Project & Tests

### Start Server
```bash
npm start
```
Access at: `http://localhost:3000`

### Run Verification Test Suite
```bash
npm test
```
*(Executes all tests across Modules 1, 2, 3, 4, 6, and 7. The server must be running on port 3000.)*
