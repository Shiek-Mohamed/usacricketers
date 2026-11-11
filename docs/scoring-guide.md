# Live Scoring App — User Guide

A complete guide for scorers, administrators, and viewers of the USACricketers live scoring system.

---

## Table of Contents

1. [For Administrators: Creating Scorer Accounts](#1-for-administrators-creating-scorer-accounts)
2. [For Scorers: Getting Started](#2-for-scorers-getting-started)
3. [Match Day: Setting Up a Match](#3-match-day-setting-up-a-match)
4. [Ball-by-Ball Scoring](#4-ball-by-ball-scoring)
5. [Keyboard Shortcuts](#5-keyboard-shortcuts)
6. [Wickets & Dismissals](#6-wickets--dismissals)
7. [Advanced Features](#7-advanced-features)
8. [Undo & Recovery](#8-undo--recovery)
9. [For Viewers: Following Live Scores](#9-for-viewers-following-live-scores)

---

## 1. For Administrators: Creating Scorer Accounts

Scorer accounts are created by **site admins** or **league admins**.

### Site Admin Flow

1. Log in to the admin CMS at `https://usacricketers.fly.dev` → Admin
2. In the sidebar, click **Scorers** (under System section)
3. Click **+ New Scorer**
4. Fill in:
   - **Username** — unique, cannot be changed later (e.g., `johnscorer`)
   - **Email** — required, for notifications
   - **Display name** — shown on the scorer dashboard (e.g., `John Smith`)
   - **Password** — give to the scorer (they can't change it themselves)
   - **Active** — toggle on/off to enable/disable login
   - **Tournaments** — check the box(es) for the series this scorer can score
5. Click **Create Scorer**

The scorer can now log in with their username + password and will only see matches in their assigned tournaments.

### League Admin Flow

League admins follow the same flow but can only assign scorers to leagues they manage (via the League Admin dashboard).

---

## 2. For Scorers: Getting Started

### Logging In

1. Visit `https://usacricketers.fly.dev`
2. Click the green **Live Scoring** button (top-right)
3. On the landing page, click **Sign in to score**
4. Enter your **username** and **password**
5. Click **Sign in**

After login, you'll see your **Scorer Dashboard**:

- **Welcome header** — your name + assigned tournaments
- **Live Now** — matches currently in progress (red dot)
- **Upcoming** — matches scheduled but not yet started
- **Recently Completed** — last 5 finished matches

Click any match to enter the scoring interface.

### If You Don't See Any Matches

Your admin hasn't assigned you to the match's tournament. Contact your admin to add the tournament to your assignments.

---

## 3. Match Day: Setting Up a Match

When you click a match, you'll see the **Setup Screen**:

### Step 1: Record the Toss (Optional)

- **Won by** — select the team that won the toss
- **Elected to** — select "bat" or "bowl"
- Setting both auto-selects the batting-first team

### Step 2: Select Batting First

If you didn't record the toss, manually select which team bats first from the dropdown.

### Step 3: Select Opening Players

- **Striker** — the batsman on strike (facing the first ball)
- **Non-striker** — the batsman at the other end
- **Opening bowler** — the bowler delivering the first over

> **Player not in the list?** Use the "Add player not in list" form below the dropdowns. Enter the player's name, select their team, pick a role (Batsman/Bowler/All-rounder/Wicket-keeper), and click Add. The player will appear in the dropdown.

### Step 4: Start the Innings

Click the red **Start innings (set LIVE)** button. This:
- Sets the match status to "live" (visible to all viewers)
- Begins the scoring session
- Broadcasts the initial state via real-time WebSocket

> **Prerequisites**: All four slots (striker, non-striker, bowler, batting-first) must be set, and the connection must show "Connected" (green pill).

---

## 4. Ball-by-Ball Scoring

Once the innings is live, you'll see the **Scoring Interface**:

### Live Scoreboard (top)

| Element | Description |
|---|---|
| **Score** | `runs/wickets (overs.balls)` — e.g., `127/3 (15.2)` |
| **CRR** | Current run rate |
| **RRR** | Required run rate (if chasing) |
| **Balls left** | Remaining balls in the innings (limited-overs) |
| **Striker** | Name + runs(balls) — the batsman on strike |
| **Non-striker** | Name + runs(balls) — the batsman at the other end |
| **Bowler** | Name + overs-maidens-runs-wickets |
| **Free Hit** | Amber badge (pulsing) when active (after a no-ball) |

### Ball Pad (main scoring area)

Tap the appropriate button after each delivery:

| Button | What it records |
|---|---|
| **0 (•)** | Dot ball — no runs |
| **1** | Single — 1 run, strike rotates |
| **2** | Two runs |
| **3** | Three runs (rare) |
| **4** | Boundary — 4 runs (sky blue) |
| **6** | Six — 6 runs (fuchsia) |
| **Wide** | +1 run, doesn't count as a ball |
| **No Ball** | +1 run, doesn't count as a ball, **free hit next ball** |
| **Wicket** | Opens the wicket dialog (see below) |

### Automatic Behaviors

- **Strike rotation** — odd runs (1, 3) swap striker/non-striker automatically
- **End of over** — strike swaps, bowler slot clears (pick the next bowler)
- **Maiden over** — detected automatically (0 runs + 0 wickets in the over)
- **Bowler restriction** — can't pick the same bowler for two consecutive overs
- **New batsman picker** — appears automatically when a wicket falls
- **New bowler picker** — appears automatically at the end of each over
- **Innings end** — detected automatically (all-out, overs complete, or target reached)
- **Match end** — detected automatically with result computed

### Commentary Feed (right side)

Every ball is automatically logged with color-coded commentary:
- Red — wickets
- Purple — sixes
- Sky blue — fours
- Amber — extras (wides, no-balls)
- Emerald — runs and manual commentary
- Gray — dot balls and over summaries

You can also add **manual commentary** in the blue text box below the ball pad, or record **voice clips** using the green Record button.

---

## 5. Keyboard Shortcuts

For fast scoring on a laptop/desktop, use keyboard shortcuts:

| Key | Action |
|---|---|
| `0` | Dot ball |
| `1` | One run |
| `2` | Two runs |
| `3` | Three runs |
| `4` | Four runs |
| `6` | Six runs |
| `.` or `-` | Dot ball (alternative) |
| `w` | Open wicket dialog |
| `e` | Swap ends (striker and non-striker) |
| `u` | Undo last action |
| `d` | Declare innings (Test matches only) |
| `s` | Save scorecard manually |

**Shortcuts are disabled when:**
- You're typing in a text input, textarea, or dropdown
- The wicket dialog is open
- No live innings is in progress
- Striker, non-striker, or bowler slot is empty

---

## 6. Wickets & Dismissals

When you tap **Wicket**, a dialog opens:

### Step 1: Select Dismissal Type

| Type | How it works | Bowler credited? |
|---|---|---|
| **Bowled** | Bowler hits the stumps | Yes |
| **Caught** | Fielder catches the ball | Yes |
| **LBW** | Leg before wicket | Yes |
| **Run Out** | Fielder breaks stumps while batsmen are running | No |
| **Stumped** | Keeper breaks stumps while batsman is out of crease | Yes |
| **Hit Wicket** | Batsman hits the stumps while playing a shot | Yes |
| **Retired Hurt** | Batsman leaves injured (can return later) | No (not a dismissal) |
| **Retired Out** | Batsman retires voluntarily (counts as out) | No |

### Step 2: Select Fielder (if applicable)

- For **caught**, **stumped**, and **run out** — select the fielder from the dropdown
- For **stumped** — the wicket-keeper is auto-prefilled

### Step 3: Select Which Batsman (run out only)

- For **run out** — choose whether the striker or non-striker is out

### Step 4: Confirm

A live dismissal preview shows (e.g., `Smith c Jones b Cummins`). Click **Confirm** to record the wicket.

### Free Hit Rule

When a **free hit** is active (after a no-ball), bowler-credited dismissals (bowled, caught, LBW, stumped, hit wicket) are **rejected** by the engine. The batsman survives. Use **Run Out** instead if a wicket falls on a free hit.

---

## 7. Advanced Features

### Toolbar Buttons

| Button | When available | What it does |
|---|---|---|
| **Undo** | Always | Reverts the last action (up to 50 actions) |
| **Declare** | Test matches only | Ends the current innings (declaration) |
| **Follow-on** | Test matches, after innings 1, lead >= 200 runs | Forces the opposing team to bat again immediately |
| **Super Over** | Limited-overs, match tied, completed | Triggers a one-over-per-side tiebreaker |
| **Save** | Always | Manually saves the scorecard to the database |
| **DLS** | Limited-overs, innings 2+, live | Opens the Duckworth-Lewis-Stern rain calculator |

### Changing Batsmen and Bowlers

- **Swap Ends** — swap striker and non-striker manually (button between the two batsman cells). Available anytime — useful when the auto strike-rotation disagrees with reality.
- **Change Batsman** — at the end of an over, a change button appears next to each batsman. Use it to substitute (e.g., if a batsman retired hurt and is returning).
- **Change Bowler** — at the end of each over, the bowler slot clears and a picker appears. Select the next bowler (can't be the same as the previous over).

### DLS Calculator (Rain Interruptions)

1. Click **DLS** in the toolbar (appears during the second innings of a limited-overs match)
2. The panel auto-fills Team 1 and Team 2 scores from the current match state
3. Enter **Revised overs for Team 2** (the reduced overs after rain)
4. Click **Calculate** — shows the revised target, resources %, and required run rate
5. Click **Apply Target to Match** — broadcasts the revised target to all viewers

The DLS calculator uses the **Standard Edition** (publicly available). For professional matches, an ICC-licensed Professional Edition may be required.

### Voice Clips

1. Click the green **Record** button in the commentary area
2. Speak your commentary (browser will request microphone access)
3. Click **Stop Recording**
4. The audio clip uploads automatically and appears in the commentary feed as a playable audio player

---

## 8. Undo and Recovery

### Undo

- Click **Undo** in the toolbar (or press `u`)
- Reverts the last ball/action (up to 50 actions back)
- Works for: runs, wickets, extras, declarations, bowler changes
- Each undo is logged in the audit trail

### Auto-Save and Recovery

The scoring app is designed for **unreliable WiFi at cricket grounds**:

| Mechanism | How it works |
|---|---|
| **WebSocket buffering** | If the connection drops, scoring actions are buffered and flushed when reconnected — no data lost |
| **localStorage backup** | Every state change is saved to your browser's localStorage (key: `live-score:{matchId}`) |
| **Database backup** | The full match state is saved to the database every ~800ms (debounced) |
| **Resume session** | If you close your browser or the score-service restarts, you'll see a "Resume Scoring Session" banner — click it to pick up where you left off |
| **Cross-browser resume** | If you switch devices, the database backup restores the state — works up to 72 hours |

### Manual Save

Click **Save** in the toolbar (or press `s`) to force-save the scorecard immediately. This updates the public match page with the latest scorecard.

---

## 9. For Viewers: Following Live Scores

Viewers don't need an account — they follow live scores on the public site:

### Match Detail Page

Visit `https://usacricketers.fly.dev/matches/{match-id}` — shows:
- Live scorecard with batting/bowling tables
- Commentary tab (ball-by-ball feed)
- Squads tab
- Match info tab
- Auto-updates in real-time via WebSocket

### Live Blog View

Some matches have a dedicated live blog — shows:
- Full-screen ball-by-ball commentary feed
- Key moments sidebar (wickets, sixes, boundaries)
- Color-coded entries matching the scoring commentary
- Inline audio players for voice clips
- Automatic reconnection if the connection drops

### Score Strip (Homepage)

The homepage carousel shows live match scores at the top, updating in real-time.

---

## Quick Reference Card

```
SCORING SHORTCUTS
-----------------
0/./-  Dot ball        w  Wicket
1      One run          e  Swap ends
2      Two runs         u  Undo
3      Three runs       d  Declare (Test)
4      Four (boundary)  s  Save
6      Six

SETUP CHECKLIST
---------------
[ ] Record toss (optional)
[ ] Select batting-first team
[ ] Select striker
[ ] Select non-striker
[ ] Select opening bowler
[ ] Click "Start innings (set LIVE)"

MATCH DAY TIPS
--------------
- Use keyboard shortcuts for speed
- Check "Connected" (green pill) before starting
- Undo works for up to 50 actions
- State auto-saves every ~1 second
- Can resume if browser closes (up to 72h)
- Voice clips work on mobile + desktop
- DLS panel appears automatically in 2nd innings
```

---

## Support

- **Can't log in?** Contact your admin to check your account is active and you're assigned to a tournament.
- **No matches visible?** Your admin hasn't assigned you to the match's tournament.
- **Connection keeps dropping?** The app auto-reconnects and buffers data — keep scoring, it'll sync when WiFi returns.
- **Need to score as admin?** Site admins can score directly from the admin Matches view — click the "Score" button on any match row.
