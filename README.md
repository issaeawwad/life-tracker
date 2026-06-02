# Life Tracker

A personal health and productivity dashboard. Dark theme, mobile-first.

## Stack

- **Frontend**: Vite + React + Tailwind CSS + shadcn/ui
- **Auth & DB**: Supabase (with Auth UI)
- **Backend**: Express + Node.js
- **Auth flow**: Supabase Auth UI (email/password)

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard — daily intention, mood, water, Oura placeholders |
| `/workouts` | Log and view workout history |
| `/meals` | Track meals with calories and protein |
| `/schedule` | Time-block your day |
| `/review` | Weekly review with mood/water/workout stats |

## Setup

### 1. Clone and install

```bash
cd life-tracker
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
# From your Supabase project → Settings → API
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# From Supabase → Settings → API → service_role (keep secret!)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

PORT=3001
```

### 3. Supabase — verify tables exist

Your Supabase project should already have these tables with RLS enabled:

- `profiles`
- `workspace_settings`
- `oura_tokens`
- `workouts` — columns: `id, user_id, date, type, duration_min, notes, created_at`
- `meals` — columns: `id, user_id, date, meal_type, name, calories, protein_g, created_at`
- `daily_logs` — columns: `id, user_id, date, intention, mood, water_oz, created_at`
- `schedule_blocks` — columns: `id, user_id, date, title, block_type, start_time, end_time, created_at`
- `subscriptions`

Make sure each table's RLS policy allows users to `SELECT/INSERT/UPDATE/DELETE` their own rows (where `user_id = auth.uid()`).

### 4. Run

**Development (frontend + backend together):**

```bash
npm run dev:all
```

Or run separately:

```bash
# Frontend (port 5173)
npm run dev

# Backend API (port 3001)
npm run server
```

Open [http://localhost:5173](http://localhost:5173).

## RLS Policy Example

If you need to add RLS policies, here's the pattern for any table:

```sql
-- Allow users to manage their own rows
create policy "Users manage own rows"
  on workouts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

## Project Structure

```
life-tracker/
├── src/
│   ├── components/
│   │   ├── ui/          # shadcn/ui components
│   │   ├── AuthPage.jsx # Supabase Auth UI login screen
│   │   └── Layout.jsx   # Sidebar + mobile nav
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── Workouts.jsx
│   │   ├── Meals.jsx
│   │   ├── Schedule.jsx
│   │   └── WeeklyReview.jsx
│   ├── lib/
│   │   ├── supabase.js  # Supabase client
│   │   └── utils.js
│   ├── App.jsx          # Router + auth state
│   └── index.css        # Tailwind + CSS variables
├── server/
│   └── index.js         # Express API
├── .env.example
└── vite.config.js
```
