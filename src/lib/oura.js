// ─── Swap this one line to go live: change true → false ───────────────────────
const USE_MOCK_DATA = true
// ──────────────────────────────────────────────────────────────────────────────

const MOCK_DATA = {
  connected: true,
  mockMode: true,
  readiness: 82,
  sleep: 78,
  hrv: 45,
  restingHR: 58,
  sleepDuration: '7h 20m',
}

async function fetchFromAPI(session) {
  const res = await fetch('/api/oura/data', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (!res.ok) return { connected: false, mockMode: false }
  return { ...(await res.json()), mockMode: false }
}

export async function fetchOuraData(session) {
  if (USE_MOCK_DATA) return MOCK_DATA
  return fetchFromAPI(session)
}

export async function getOuraConnectUrl(session) {
  const res = await fetch('/api/oura/connect', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  const { url } = await res.json()
  return url
}

/** green ≥ 85 · yellow 60–84 · red < 60 · muted if null */
export function scoreColor(score) {
  if (score == null) return 'muted'
  if (score >= 85) return 'green'
  if (score >= 60) return 'yellow'
  return 'red'
}
