# Call Tally — Admissions Telecalling & Team Tracker

A mobile-friendly daily call logging, supervisor reporting, and team collaboration web application designed for college admissions callers and intern teams.

---

##  Purpose

During college admissions campaigns, intern telecallers need a fast, distraction-free way to log outbound calls, track caller outcomes, submit end-of-day reports to supervisors, and coordinate with their team in real time. 

**Call Tally** solves this by:
1. Providing one-tap counter controls that accurately track dialed totals (Received vs. Not Received) and shared outcome subcategories.
2. Generating automated daily summary remarks and one-click pre-filled Google Form submissions for supervisor reporting.
3. Displaying a real-time shared daily target showing collective progress across all active callers.
4. Offering an integrated team chat lounge and direct coworker messaging directly inside the workspace.

---

##  Key Features

### 1. Accurate Call & Subcategory Counting
- **Dialed Math Invariant**: Calls Dialed is strictly calculated as `Received + Not Received`. Subcategories (e.g., *Admitted Elsewhere*, *Interested / Campus Visit*, *Follow-up Needed*) do not inflate the dialed total.
- **Customizable Counters**: Rename counters, update descriptions, or add new custom subcategories anytime.
- **Cloud Persistence**: Counts are saved securely to the cloud and tied to each user's daily record.

### 2. Daily Reporting & Google Form Integration
- **Automated Summary Remarks**: Generate structured daily remarks including pickup rate, outcome breakdown percentages, and follow-up counts with daily phrasing variations.
- **Historical Snapshots**: Archive each day's report and review past call logs without altering live counter configurations.
- **One-Click Form Export**: Pre-populates the official supervisor Google Form with that day's exact numbers and remarks, eliminating manual data entry.

### 3. Shared Daily Target & Milestones
- **Personal Assigned Goal**: Callers enter their daily assigned target (e.g., 60 calls) in the top header.
- **Collective Progress Bar**: Automatically calculates total calls dialed across all active teammates versus the combined team target.
- **Live Caller Roster**: View teammates online status, their individual progress bars, and trigger milestone celebrations upon reaching goals.
- **Background Sync**: Quietly refreshes team stats and progress every 60 seconds without requiring a full page reload.

### 4. Built-in Team Chat
- **Group Lounge & Direct DMs**: Chat with the whole team or message individual coworkers directly from the right-side drawer.
- **Simple Workspace Access**: Teammates join instantly using the shared workspace access code (`FOOTSET2026`).
- **Cross-Device Sync**: Message history remains intact when switching between phones and laptops.
- **Customization & Audio Controls**: Editable member nicknames, per-chat mute toggles, global sound controls, and Web Audio chimes for new messages and goal milestones.

### 5. Design & Usability
- Full light and dark mode support with instant theme switching.
- Responsive mobile-first interface optimized for one-thumb logging while actively on phone calls.

---

##  Tech Stack

- **Frontend**: React 19, TanStack Start, TanStack Router, Tailwind CSS, Lucide Icons
- **Backend & Database**: PostgreSQL, Realtime subscriptions, Row-Level Security (RLS)
- **Audio**: Native Web Audio API for message and milestone sound effects

---

Made by ayus
Idea brainstormed by Sandesh - Intern
