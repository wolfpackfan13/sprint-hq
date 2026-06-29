# SprintHQ — Project Reference

> Internal reference doc. Captures who this is for, the constraints and goals set, what's built, the tech stack, and what's ahead. Keep this current as the project evolves.

## What it is
A personal command-center / productivity web app ("SprintHQ") built for a multi-business entrepreneur to manage tasks, projects, clients/areas, meetings, time tracking, and invoicing across all his ventures. The guiding vision: **a system that briefs you and executes — not a productivity hobby you maintain.** It exists to decide what deserves attention and surface neglected work, so things don't die in the gap between out-of-sight and on-the-calendar.

## Who it's for (drives every design decision)
- Self-employed entrepreneur running multiple businesses: a faith-based housing fund, real estate flips, a handyman business, and a personal coaching/content brand.
- **ESTJ, Enneagram 8, DI on DISC, with ADHD.** Translation that governs the build: wants control and results, delegates the busywork but keeps every decision/approval, wants structure delivered fast and direct, and needs the system to hold the memory and surface the next move. **Killed by clutter** — the app must do more while showing less. AI features are always propose-and-approve (chief-of-staff model), never silent auto-creation.

## Core organizing principle
**Client/Area is the unit of tracking, not the individual contact.** A contact can go quiet for months and that's fine if the work is moving. "Needs attention" is measured at the client/area level (last activity across its tasks, projects, meetings). Contacts are a reference roster underneath, not the thing being tracked.

## Restrictions & preferences communicated
- **Division of labor:** Google Drive holds documents/artifacts (contracts, sheets, anything formatted/shared). SprintHQ holds the connective tissue — notes, decisions, action items, history, "what's next" — and links Drive docs in as resources.
- **AI must propose, not auto-execute.** Review-first on everything (e.g., Prep My Day proposes tasks for approval; never silent creation).
- **Calendar writes** (time-blocking) are wanted, but viewing came first.
- **Simplicity discipline:** resist feature sprawl and menu bloat; consolidate rather than expand.
- **Foundation before features:** chose to migrate to proper relational tables before building more AI features, accepting an unglamorous build to get a sturdy base.
- Email automation (reading inbox to propose tasks/draft replies) is approved in principle, approval-gated.

## Tech stack (currently running)
- **Frontend:** React 18 + Vite 5 (must stay vite ^5.3.4 — vite 8 breaks the React plugin) + TailwindCSS + lucide-react icons.
- **Hosting:** GitHub Pages. Source on `main` branch → GitHub Actions builds → publishes to `gh-pages`. Workflow uses `npm install --legacy-peer-deps`.
- **Backend/sync:** Supabase (Postgres) with email+password auth and row-level security. Relational tables (companies, goals, projects, tasks, meetings, contacts, notes, invoices) plus an `app_state` table for singletons. Nested detail (subtasks, time entries, resources, action items) kept as JSONB columns on parent rows. Local-first: localStorage is the instant offline layer, changes diff-sync to Supabase row-by-row.
- **Integrations:** Google OAuth (Calendar read, Drive, Gmail) via a Client ID pasted in Settings. Anthropic API (model `claude-sonnet-4-6`) called browser-direct for AI features, key pasted in Settings.
- **User's environment:** Windows, deploys via Command Prompt (PowerShell blocks npm scripts), Node.js installed. Local repo at `C:\Users\5700xUser\Downloads\sprint-hq`.

## Architecture map
- **Hooks** (`src/hooks/`): useTasks, useProjects, useMeetings, useCompanies, useGoals, useContacts, useNotes, useInvoices, useSettings, useGoogle, useSync, useTimer.
- **Views** (`src/views/`): DoView (Today), AllTasks, WeekBoard, Projects, ProjectDetail, Clients, ClientCockpit, Meetings, Relationships, Goals, Hours, WeeklyReview, Briefing, Notes, SprintView, Calendar, PrepDay, Archive, Settings.
- **Components** (`src/components/`): TopBar, Sidebar, MobileNav, TaskCard, TaskModal, MeetingModal, ProjectModal, ClientForm, ManageClients, SubtaskEditor, TimeLogEditor, ResourceLinks, BulkActionBar, GlobalTimer, SearchOverlay, BreakdownModal, Toast, Login, SyncIndicator, Celebration, PageContainer.
- **Utils** (`src/utils/`): storage (localStorage + change events), supabase, dataMap (camelCase↔snake_case), dataEngine (row-level sync + migration), dateUtils/calUtils, timeUtils, aiBreakdown, calendarMatch, invoicePDF.

## Outputs we've landed on (built & shipping)
- **Navigation:** DO / PLAN / TRACK / Assist groups; desktop sidebar, mobile bottom tabs + "More" sheet. Calm single-line top bar with global **+ New**, **Search**, global **timer**, sync status, account menu, client filter.
- **DO:** Today (Top 3, missed triage, unscheduled orphans), All Tasks (full pipeline grouped by horizon: overdue → today → tomorrow → this week → later → someday), Calendar (day/week/month, Google events), Prep My Day (AI proposes prep tasks from calendar).
- **PLAN:** Clients & Areas overview (with "going quiet" staleness flags) → Client Cockpit (what's next / timeline / projects / meetings); This Week drag-and-drop board with project-due chips; Projects → Project Detail drill-in; Goals; 12-Week Sprint (inline setup, weekly goals).
- **TRACK:** Meetings (action items auto-convert to tasks, attach to project/client), Relationships, Hours & Invoices (time rolls up by client, billable rates, PDF invoices, editable/manual time entries), Weekly Review, Completed archive (incl. closed projects).
- **Cross-cutting:** global search across everything; bulk-select tasks → assign to client/project, set due date, delete; global start-anywhere timer with assign-on-stop; resource links on tasks & projects; editable subtasks; undo toast on complete; AI task breakdown.

## Roadmap (agreed sequence)
1. Sync (Supabase) — **done**
2. Consolidate navigation / cockpit / calendar — **done**
3. Relational-tables migration — **done**
4. **NEXT: AI Planner** — reads what's neglected per client/area, proposes time-blocks, writes them to Google Calendar (two-way), user approves. This is the payoff feature described as "the whole point."
5. Email → tasks/drafts automation + morning brief / weekly close-out (chief-of-staff layer).

## Known open items / honest caveats
- **Data sync is "last write wins"** — fine for solo cross-device use; flagged for completeness.
- A past incident where data appeared to "disappear" after a sync login; user chose to move on. Be careful with any migration to not lose data — confirm state on both devices before building on it.
- Anthropic API key is exposed in browser network calls — acceptable for personal single-user use, not for distribution.
- Versions shipped through **v14**.

## Deploy flow
1. Unzip the new version over `C:\Users\5700xUser\Downloads\sprint-hq` (Yes to All).
2. In Command Prompt (not PowerShell):
   ```
   cd C:\Users\5700xUser\Downloads\sprint-hq
   git add .
   git commit -m "message"
   git push
   ```
3. Watch the build at github.com/wolfpackfan13/sprint-hq/actions until green.
4. Hard refresh: **Ctrl+Shift+R**.
- New dependencies require `npm install --legacy-peer-deps` first.
- Live URL: https://wolfpackfan13.github.io/sprint-hq/
