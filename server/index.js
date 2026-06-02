import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import crypto from 'crypto'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const app = express()
const PORT = process.env.PORT || 3001

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

// Middleware: verify Supabase JWT
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return res.status(401).json({ error: 'Invalid token' })

  req.user = user
  next()
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

// --- Daily Logs ---
app.get('/api/daily-logs', requireAuth, async (req, res) => {
  const { date, limit = 30 } = req.query
  let query = supabase
    .from('daily_logs')
    .select('*')
    .eq('user_id', req.user.id)
    .order('date', { ascending: false })
    .limit(parseInt(limit))

  if (date) query = query.eq('date', date)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

app.post('/api/daily-logs', requireAuth, async (req, res) => {
  const { date, intention, mood, water_oz } = req.body
  const { data, error } = await supabase
    .from('daily_logs')
    .upsert({ user_id: req.user.id, date, intention, mood, water_oz }, { onConflict: 'user_id,date' })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// --- Workouts ---
app.get('/api/workouts', requireAuth, async (req, res) => {
  const { from, to, limit = 30 } = req.query
  let query = supabase
    .from('workouts')
    .select('*')
    .eq('user_id', req.user.id)
    .order('date', { ascending: false })
    .limit(parseInt(limit))

  if (from) query = query.gte('date', from)
  if (to) query = query.lte('date', to)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

app.post('/api/workouts', requireAuth, async (req, res) => {
  const { date, type, duration_min, notes } = req.body
  const { data, error } = await supabase
    .from('workouts')
    .insert({ user_id: req.user.id, date, type, duration_min, notes })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

app.delete('/api/workouts/:id', requireAuth, async (req, res) => {
  const { error } = await supabase
    .from('workouts')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)

  if (error) return res.status(500).json({ error: error.message })
  res.status(204).end()
})

// --- Meals ---
app.get('/api/meals', requireAuth, async (req, res) => {
  const { from, to, limit = 50 } = req.query
  let query = supabase
    .from('meals')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(parseInt(limit))

  if (from) query = query.gte('date', from)
  if (to) query = query.lte('date', to)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

app.post('/api/meals', requireAuth, async (req, res) => {
  const { date, meal_type, name, calories, protein_g } = req.body
  const { data, error } = await supabase
    .from('meals')
    .insert({ user_id: req.user.id, date, meal_type, name, calories, protein_g })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

app.delete('/api/meals/:id', requireAuth, async (req, res) => {
  const { error } = await supabase
    .from('meals')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)

  if (error) return res.status(500).json({ error: error.message })
  res.status(204).end()
})

// --- Schedule Blocks ---
app.get('/api/schedule', requireAuth, async (req, res) => {
  const { date } = req.query
  let query = supabase
    .from('schedule_blocks')
    .select('*')
    .eq('user_id', req.user.id)
    .order('start_time', { ascending: true })

  if (date) query = query.eq('date', date)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

app.post('/api/schedule', requireAuth, async (req, res) => {
  const { date, title, block_type, start_time, end_time } = req.body
  const { data, error } = await supabase
    .from('schedule_blocks')
    .insert({ user_id: req.user.id, date, title, block_type, start_time, end_time })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(data)
})

app.delete('/api/schedule/:id', requireAuth, async (req, res) => {
  const { error } = await supabase
    .from('schedule_blocks')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)

  if (error) return res.status(500).json({ error: error.message })
  res.status(204).end()
})

// ─── Oura Ring OAuth2 + Data ──────────────────────────────────────────────────

// In-memory state store (maps random state string → userId, TTL 10 min)
const oauthStates = new Map()

// Step 1: redirect user to Oura authorization page
app.get('/api/oura/connect', requireAuth, (req, res) => {
  const clientId = process.env.OURA_CLIENT_ID
  if (!clientId) return res.status(500).json({ error: 'OURA_CLIENT_ID not configured' })

  const state = crypto.randomUUID()
  oauthStates.set(state, req.user.id)
  setTimeout(() => oauthStates.delete(state), 10 * 60 * 1000)

  const redirectUri = process.env.OURA_REDIRECT_URI || 'http://localhost:3001/api/oura/callback'
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'daily heartrate',
    state,
  })

  res.json({ url: `https://cloud.ouraring.com/oauth/authorize?${params}` })
})

// Step 2: Oura redirects here with ?code=&state=
app.get('/api/oura/callback', async (req, res) => {
  const { code, state } = req.query
  const userId = oauthStates.get(state)
  if (!userId) return res.status(400).send('Invalid or expired OAuth state.')
  oauthStates.delete(state)

  const redirectUri = process.env.OURA_REDIRECT_URI || 'http://localhost:3001/api/oura/callback'
  const tokenRes = await fetch('https://api.ouraring.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: process.env.OURA_CLIENT_ID,
      client_secret: process.env.OURA_CLIENT_SECRET,
      redirect_uri: redirectUri,
    }),
  })

  if (!tokenRes.ok) return res.status(500).send('Token exchange with Oura failed.')
  const { access_token, refresh_token, expires_in } = await tokenRes.json()

  await supabase.from('oura_tokens').upsert(
    {
      user_id: userId,
      access_token,
      refresh_token,
      expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
    },
    { onConflict: 'user_id' }
  )

  res.redirect('http://localhost:5173/?oura=connected')
})

// Connection status
app.get('/api/oura/status', requireAuth, async (req, res) => {
  const { data } = await supabase
    .from('oura_tokens')
    .select('user_id')
    .eq('user_id', req.user.id)
    .maybeSingle()
  res.json({ connected: !!data })
})

// Fetch today's Oura data (called by frontend when USE_MOCK_DATA = false)
app.get('/api/oura/data', requireAuth, async (req, res) => {
  const { data: tokenRow } = await supabase
    .from('oura_tokens')
    .select('*')
    .eq('user_id', req.user.id)
    .maybeSingle()

  if (!tokenRow) return res.json({ connected: false })

  let accessToken = tokenRow.access_token

  // Refresh token if expired
  if (new Date(tokenRow.expires_at) <= new Date()) {
    const refreshRes = await fetch('https://api.ouraring.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokenRow.refresh_token,
        client_id: process.env.OURA_CLIENT_ID,
        client_secret: process.env.OURA_CLIENT_SECRET,
      }),
    })
    if (!refreshRes.ok) return res.json({ connected: false })
    const refreshed = await refreshRes.json()
    accessToken = refreshed.access_token
    await supabase.from('oura_tokens').update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
    }).eq('user_id', req.user.id)
  }

  const today = new Date().toISOString().split('T')[0]
  const headers = { Authorization: `Bearer ${accessToken}` }

  const [readinessRes, sleepRes] = await Promise.all([
    fetch(`https://api.ouraring.com/v2/usercollection/daily_readiness?start_date=${today}&end_date=${today}`, { headers }),
    fetch(`https://api.ouraring.com/v2/usercollection/daily_sleep?start_date=${today}&end_date=${today}`, { headers }),
  ])

  const [readinessJson, sleepJson] = await Promise.all([readinessRes.json(), sleepRes.json()])

  const readiness = readinessJson.data?.[0]
  const sleep = sleepJson.data?.[0]
  const totalSec = sleep?.total_sleep_duration ?? null

  res.json({
    connected: true,
    readiness: readiness?.score ?? null,
    sleep: sleep?.score ?? null,
    hrv: sleep?.average_hrv ?? null,
    restingHR: readiness?.contributors?.resting_heart_rate ?? null,
    sleepDuration: totalSec
      ? `${Math.floor(totalSec / 3600)}h ${Math.floor((totalSec % 3600) / 60)}m`
      : null,
  })
})

// ─── Grocery List (Claude AI) ─────────────────────────────────────────────────

app.post('/api/grocery-list', requireAuth, async (req, res) => {
  const { meals } = req.body

  if (!meals?.length) return res.status(400).json({ error: 'No meals provided' })
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })
  }

  const mealLines = meals
    .map(m => {
      const parts = [m.day, m.meal_type, m.name]
      const meta = []
      if (m.calories) meta.push(`${m.calories} cal`)
      if (m.protein_g) meta.push(`${m.protein_g}g protein`)
      return meta.length ? `${parts.join(' · ')} (${meta.join(', ')})` : parts.join(' · ')
    })
    .join('\n')

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Here are my planned meals for the week:\n\n${mealLines}\n\nGenerate a practical grocery list organized by these categories: 🥬 Produce, 🥩 Proteins, 🥛 Dairy, 🌾 Grains & Carbs, 🫙 Pantry & Condiments. Include estimated quantities (e.g. "2 lbs", "1 dozen"). Format as a clean markdown list. Be concise — skip items you can't confidently infer from the meals.`,
      },
    ],
  })

  res.json({ groceryList: response.content[0].text })
})

app.listen(PORT, () => {
  console.log(`Life Tracker API running on http://localhost:${PORT}`)
})
