import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Lightning,
  Moon,
  Heartbeat,
  Heart,
  Bed,
  Drop,
  Minus,
  Plus,
  CalendarBlank,
  CircleNotch,
  CheckCircle,
  Link,
  Pulse,
} from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import { fetchOuraData, getOuraConnectUrl } from '@/lib/oura'
import { formatDate, todayISO } from '@/lib/utils'
import { ArcGauge } from '@/components/ui/arc-gauge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

// ─── Animation config ─────────────────────────────────────────────────────────

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1] } },
}

// ─── Oura hero cards ──────────────────────────────────────────────────────────

function ReadinessHero({ score, mockMode }) {
  const isGood = score != null && score >= 85
  return (
    <div
      className="rounded-2xl overflow-hidden relative"
      style={{
        background: 'linear-gradient(160deg, #0d2a18 0%, #061409 55%, #0a0a0a 100%)',
        boxShadow: isGood
          ? 'inset 0 0 80px rgba(173,255,47,0.04), 0 0 0 1px rgba(173,255,47,0.14)'
          : '0 0 0 1px rgba(255,255,255,0.06)',
      }}
    >
      {/* Atmospheric glow orb */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: isGood
            ? 'radial-gradient(ellipse at 50% 0%, rgba(173,255,47,0.07) 0%, transparent 65%)'
            : 'radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.02) 0%, transparent 65%)',
        }}
      />
      <div className="relative z-10 pt-8 pb-5 px-6 flex flex-col items-center">
        <div className="flex items-center gap-2 mb-5">
          <Lightning size={12} weight="fill" className="text-white/30" />
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
            Readiness
          </p>
          {mockMode && (
            <span className="text-[9px] uppercase tracking-widest text-white/20 bg-white/5 border border-white/10 rounded-full px-2 py-0.5">
              Demo
            </span>
          )}
        </div>
        <div className="w-52">
          <ArcGauge score={score} numberClassName="text-7xl" showStatus />
        </div>
        <p className="text-[11px] text-white/25 mt-3">Today's recovery baseline</p>
      </div>
    </div>
  )
}

function ScoreArcCard({ label, score, bg, icon: Icon }) {
  return (
    <div
      className="rounded-2xl overflow-hidden relative flex-1"
      style={{ background: bg, boxShadow: '0 0 0 1px rgba(255,255,255,0.06)' }}
    >
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.02) 0%, transparent 70%)',
      }} />
      <div className="relative z-10 pt-5 pb-4 px-4 flex flex-col items-center">
        <div className="flex items-center gap-1.5 mb-4">
          <Icon size={11} className="text-white/30" />
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">{label}</p>
        </div>
        <ArcGauge score={score} numberClassName="text-4xl" showStatus />
      </div>
    </div>
  )
}

function StatCard({ label, value, unit, icon: Icon }) {
  return (
    <div
      className="rounded-2xl bg-card border border-border flex-1 p-5"
      style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.04)' }}
    >
      <div className="flex items-center gap-1.5 mb-3">
        <Icon size={11} className="text-muted-foreground/60" />
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="font-display text-3xl font-bold text-foreground tabular-nums leading-none">
        {value ?? '—'}
      </p>
      {unit && value != null && (
        <p className="text-[11px] text-muted-foreground mt-1.5">{unit}</p>
      )}
    </div>
  )
}

// ─── Mood ─────────────────────────────────────────────────────────────────────

const MOOD_EMOJIS = { 1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😄' }
const MOOD_LABELS = { 1: 'Low', 2: 'Meh', 3: 'Okay', 4: 'Good', 5: 'Great' }

// ─── Dashboard ────────────────────────────────────────────────────────────────

const WATER_GOAL_OZ = 96

export default function Dashboard() {
  const today = todayISO()

  const [log, setLog] = useState(null)
  const [intention, setIntention] = useState('')
  const [mood, setMood] = useState(null)
  const [waterOz, setWaterOz] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [oura, setOura] = useState(null)
  const [ouraConnecting, setOuraConnecting] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) fetchOuraData(session).then(setOura)
    })
    const params = new URLSearchParams(window.location.search)
    if (params.get('oura') === 'connected') window.history.replaceState({}, '', '/')
  }, [])

  const handleOuraConnect = async () => {
    setOuraConnecting(true)
    const { data: { session } } = await supabase.auth.getSession()
    const url = await getOuraConnectUrl(session)
    window.location.href = url
  }

  const loadTodayLog = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle()
    if (data) {
      setLog(data)
      setIntention(data.intention || '')
      setMood(data.mood || null)
      setWaterOz(data.water_oz || 0)
    }
    setLoading(false)
  }, [today])

  useEffect(() => { loadTodayLog() }, [loadTodayLog])

  const saveLog = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const payload = {
      user_id: user.id,
      date: today,
      intention: intention || null,
      mood: mood || null,
      water_oz: waterOz,
    }
    const { error } = log?.id
      ? await supabase.from('daily_logs').update(payload).eq('id', log.id)
      : await supabase.from('daily_logs').upsert(payload, { onConflict: 'user_id,date' })
    if (!error) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      await loadTodayLog()
    }
    setSaving(false)
  }

  const adjustWater = (delta) => setWaterOz((prev) => Math.max(0, prev + delta))
  const waterPct = Math.min(100, (waterOz / WATER_GOAL_OZ) * 100)

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">

      {/* Header */}
      <motion.div variants={fadeUp}>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.18em] mb-1">
          {formatDate(new Date())}
        </p>
        <h2 className="font-display text-2xl font-semibold text-foreground">
          Good morning
        </h2>
      </motion.div>

      {/* ── Oura Ring ── */}
      <motion.div variants={fadeUp} className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Recovery
          </p>
          <button
            onClick={handleOuraConnect}
            disabled={ouraConnecting}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-primary transition-colors"
          >
            {ouraConnecting
              ? <CircleNotch size={12} className="animate-spin" />
              : <Link size={11} />
            }
            {oura?.connected && !oura?.mockMode ? 'Reconnect' : 'Connect Ring'}
          </button>
        </div>

        {oura?.connected ? (
          <>
            <ReadinessHero score={oura.readiness} mockMode={oura.mockMode} />

            <div className="flex gap-3">
              <ScoreArcCard
                label="Sleep"
                score={oura.sleep}
                bg="linear-gradient(160deg, #0d1535 0%, #060a1e 55%, #0a0a0a 100%)"
                icon={Moon}
              />
              <ScoreArcCard
                label="HRV"
                score={oura.hrv}
                bg="linear-gradient(160deg, #2a1800 0%, #180e00 55%, #0a0a0a 100%)"
                icon={Heartbeat}
              />
            </div>

            <div className="flex gap-3">
              <StatCard label="Resting HR" value={oura.restingHR} unit="bpm" icon={Heart} />
              <StatCard label="Sleep" value={oura.sleepDuration} unit="duration" icon={Bed} />
            </div>
          </>
        ) : (
          <div
            className="rounded-2xl border border-dashed border-border p-8 flex flex-col items-center gap-3 text-center"
            style={{ borderColor: 'rgba(255,255,255,0.1)' }}
          >
            <Pulse size={30} className="text-muted-foreground/25" />
            <p className="text-sm text-muted-foreground">
              Connect your Oura Ring to see today's recovery scores
            </p>
            <Button variant="outline" size="sm" onClick={handleOuraConnect} disabled={ouraConnecting}>
              {ouraConnecting ? <CircleNotch size={12} className="animate-spin" /> : <Link size={12} />}
              Connect Oura Ring
            </Button>
          </div>
        )}
      </motion.div>

      {/* ── Daily Intention ── */}
      <motion.div variants={fadeUp}>
        <div className="rounded-2xl bg-card border border-border p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Today's Intention
          </p>
          <Textarea
            placeholder="What's your focus for today?"
            value={intention}
            onChange={(e) => setIntention(e.target.value)}
            className="resize-none min-h-[72px] bg-secondary border-0 rounded-xl text-sm text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary/40"
            disabled={loading}
          />
          <Button
            size="sm"
            className="mt-3 w-full"
            onClick={saveLog}
            disabled={saving || loading}
          >
            {saving ? (
              <CircleNotch size={13} className="animate-spin" />
            ) : saved ? (
              <CheckCircle size={13} weight="fill" />
            ) : null}
            {saved ? 'Saved' : 'Save'}
          </Button>
        </div>
      </motion.div>

      {/* ── Mood ── */}
      <motion.div variants={fadeUp}>
        <div className="rounded-2xl bg-card border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Mood Check-In
            </p>
            {mood && (
              <span className="text-xs font-semibold text-primary">
                {MOOD_LABELS[mood]}
              </span>
            )}
          </div>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((v) => (
              <motion.button
                key={v}
                whileTap={{ scale: 0.88 }}
                onClick={() => { setMood(v); setSaved(false) }}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-semibold transition-all ${
                  v === mood
                    ? 'border-primary bg-primary text-primary-foreground shadow-[0_0_18px_rgba(173,255,47,0.3)]'
                    : 'border-border bg-secondary text-muted-foreground hover:border-primary/30'
                }`}
              >
                <span className="text-lg leading-none">{MOOD_EMOJIS[v]}</span>
                <span className="text-[10px]">{MOOD_LABELS[v]}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Water ── */}
      <motion.div variants={fadeUp}>
        <div className="rounded-2xl bg-card border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Hydration
              </p>
              <div className="flex items-baseline gap-1 mt-1.5">
                <span className="font-display text-3xl font-bold text-foreground tabular-nums">
                  {waterOz}
                </span>
                <span className="text-xs text-muted-foreground">/ {WATER_GOAL_OZ} oz</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => adjustWater(-8)}
                className="h-9 w-9 rounded-full bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
              >
                <Minus size={14} />
              </button>
              <button
                onClick={() => adjustWater(8)}
                className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center transition-all hover:bg-primary/90"
                style={{ boxShadow: '0 0 16px rgba(173,255,47,0.3)' }}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${waterPct}%`,
                background: '#ADFF2F',
                boxShadow: waterOz > 0 ? '0 0 8px rgba(173,255,47,0.5)' : 'none',
              }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 text-right">
            {waterOz >= WATER_GOAL_OZ
              ? 'Goal reached!'
              : `${WATER_GOAL_OZ - waterOz} oz to go`}
          </p>
        </div>
      </motion.div>

      {/* ── Events placeholder ── */}
      <motion.div variants={fadeUp}>
        <div className="rounded-2xl bg-card border border-border p-5">
          <div className="flex items-center gap-2 mb-1">
            <CalendarBlank size={12} className="text-muted-foreground/60" />
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Today's Events
            </p>
          </div>
          <div className="flex flex-col items-center justify-center py-6 gap-2 text-muted-foreground">
            <CalendarBlank size={26} className="opacity-15" />
            <p className="text-xs opacity-40">Calendar integration coming soon</p>
          </div>
        </div>
      </motion.div>

    </motion.div>
  )
}
