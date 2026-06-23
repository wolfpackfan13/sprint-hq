# SprintHQ — Your 12-Week Personal OS

A fast, private, mobile-first task and sprint manager built for solo operators. No accounts, no subscriptions, no tracking — all data stored locally on your device.

## Features

- **Today** — Daily command center with quick capture
- **This Week** — Tasks grouped by day with completion tracking
- **Missed** — Overdue tasks with reschedule shortcuts
- **Notes** — Brain dump with pinning and timestamps
- **12-Week Sprint** — Visual sprint board with weekly goals

## Setup

### Local Development

```bash
# Clone your repo
git clone https://github.com/YOUR_USERNAME/sprint-hq.git
cd sprint-hq

# Install dependencies
npm install

# Run dev server
npm run dev
```

Open `http://localhost:5173`

### Deploy to GitHub Pages

1. Create a new GitHub repository named `sprint-hq` (or any name you want)

2. Push this code:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/sprint-hq.git
git push -u origin main
```

3. Enable GitHub Pages:
   - Go to repo **Settings → Pages**
   - Set **Source** to `Deploy from a branch`
   - Set **Branch** to `gh-pages` / `root`
   - Click Save

4. GitHub Actions will automatically build and deploy on every push to `main`.

5. Your app will be live at: `https://YOUR_USERNAME.github.io/sprint-hq/`

### Install as PWA (Mobile)

**iPhone/iPad:**
1. Open your GitHub Pages URL in Safari
2. Tap the Share button → "Add to Home Screen"
3. Tap Add — SprintHQ appears as an app icon

**Android:**
1. Open in Chrome
2. Tap the three-dot menu → "Add to Home screen"
3. Tap Add

**Desktop (Chrome/Edge):**
1. Look for the install icon in the address bar
2. Click Install

## Data Storage

All data is stored in your browser's `localStorage`. Nothing is sent to any server.

To backup your data: Open browser DevTools → Application → Local Storage → copy the `sprintHQ_*` keys.

## Tech Stack

- React 18 + Vite
- Tailwind CSS
- Lucide icons
- PWA (manifest + installable)
- GitHub Actions → GitHub Pages

## Phase 2 Roadmap

- [ ] Calendar import (.ics / Google Calendar sync)
- [ ] Project manager with full kanban board
- [ ] Weekly review prompt
- [ ] Google Drive / Gist sync for cross-device
- [ ] Sprint comparison / history
