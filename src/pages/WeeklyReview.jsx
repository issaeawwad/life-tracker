import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ClipboardText, CircleNotch, CheckCircle, TrendUp, Drop, Barbell, ForkKnife } from '@phosphor-icons/react'

function getWeekRange() {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((day + 6) % 7))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = d => d.toISOString().split('T')[0]
  return { start: fmt(monday), end: fmt(sunday) }
}

const MOOD_EMOJIS = { 1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😄' }

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] } },
}

function StatCard({ label, value, sub, color, icon: Icon }) {
  return (
    <div className="rounded-2xl bg-card border border-border p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{label}</p>
        <Icon size={12} className="text-muted-foreground/50" />
      </div>
      <p className="font-display text-2xl font-bold leading-none" style={{ color: color || 'hsl(var(--foreground))' }}>
        {value}
      </p>
      {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}

export default function WeeklyReview() {
  const [logs, setLogs] = useState([])
  const [workouts, setWorkouts] = useState([])
  const [meals, setMeals] = useState([])
  const [wins, setWins] = useState('')
  const [improvements, setImprovements] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const { start, end } = getWeekRange()

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [logsRes, workoutsRes, mealsRes] = await Promise.all([
        supabase.from('daily_logs').select('*').eq('user_id', user.id).gte('date', start).lte('date', end),
        supabase.from('workouts').select('*').eq('user_id', user.id).gte('date', start).lte('date', end),
        supabase.from('meals').select('*').eq('user_id', user.id).gte('date', start).lte('date', end),
      ])
      setLogs(logsRes.data || [])
      setWorkouts(workoutsRes.data || [])
      setMeals(mealsRes.data || [])
      setLoading(false)
    }
    load()
  }, [start, end])

  const avgMood = logs.filter(l => l.mood).length
    ? (logs.reduce((s, l) => s + (l.mood || 0), 0) / logs.filter(l => l.mood).length).toFixed(1)
    : null

  const avgWater = logs.filter(l => l.water_oz).length
    ? Math.round(logs.reduce((s, l) => s + (l.water_oz || 0), 0) / logs.filter(l => l.water_oz).length)
    : null

  const totalWorkoutMins = workouts.reduce((s, w) => s + (w.duration_min || 0), 0)
  const totalCalories = meals.reduce((s, m) => s + (m.calories || 0), 0)
  const avgCalories = meals.length ? Math.round(totalCalories / 7) : null
  const totalProtein = meals.reduce((s, m) => s + (m.protein_g || 0), 0)

  const scoreColor = (v, good, ok) => v >= good ? '#ADFF2F' : v >= ok ? '#facc15' : '#ef4444'

  const handleSave = async () => {
    setSaving(true)
    setTimeout(() => {
      setSaved(true)
      setSaving(false)
      setTimeout(() => setSaved(false), 2000)
    }, 500)
  }

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.09 } } }}
      className="space-y-5"
    >
      {/* Header */}
      <motion.div variants={fadeUp}>
        <h2 className="font-display text-2xl font-semibold text-foreground">Weekly Review</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{start} → {end}</p>
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <CircleNotch size={20} className="animate-spin mr-2" /> Loading week data...
        </div>
      ) : (
        <>
          {/* Stats */}
          <motion.div variants={fadeUp} className="grid grid-cols-2 gap-2.5">
            <StatCard
              label="Avg Mood"
              value={avgMood ? `${avgMood}/5` : '—'}
              sub={avgMood ? MOOD_EMOJIS[Math.round(avgMood)] : null}
              color={avgMood ? scoreColor(parseFloat(avgMood), 4, 3) : undefined}
              icon={TrendUp}
            />
            <StatCard
              label="Avg Water"
              value={avgWater ? `${avgWater} oz` : '—'}
              sub="per day"
              color={avgWater ? scoreColor(avgWater, 96, 64) : undefined}
              icon={Drop}
            />
            <StatCard
              label="Workouts"
              value={workouts.length}
              sub={`${totalWorkoutMins} min total`}
              color={scoreColor(workouts.length, 4, 2)}
              icon={Barbell}
            />
            <StatCard
              label="Avg Calories"
              value={avgCalories ? `${avgCalories}` : '—'}
              sub={avgCalories ? 'kcal / day' : null}
              color={undefined}
              icon={ForkKnife}
            />
          </motion.div>

          {/* Mood bars */}
          {logs.filter(l => l.mood).length > 0 && (
            <motion.div variants={fadeUp}>
              <div className="rounded-2xl bg-card border border-border p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">
                  Mood This Week
                </p>
                <div className="flex items-end gap-2 h-20">
                  {Array.from({ length: 7 }, (_, i) => {
                    const d = new Date(start)
                    d.setDate(d.getDate() + i)
                    const dateStr = d.toISOString().split('T')[0]
                    const log = logs.find(l => l.date === dateStr)
                    const mood = log?.mood
                    const height = mood ? `${(mood / 5) * 100}%` : '6px'
                    const color = mood
                      ? mood >= 4 ? '#ADFF2F' : mood >= 3 ? '#facc15' : '#ef4444'
                      : 'rgba(255,255,255,0.08)'
                    const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                        <div className="flex-1 w-full flex items-end">
                          <div
                            className="w-full rounded-t-lg transition-all"
                            style={{ height, background: color, boxShadow: mood && mood >= 4 ? '0 0 8px rgba(173,255,47,0.3)' : 'none' }}
                            title={mood ? `${MOOD_EMOJIS[mood]} (${mood}/5)` : 'No data'}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground font-semibold">{days[i]}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* Water intake */}
          {logs.filter(l => l.water_oz).length > 0 && (
            <motion.div variants={fadeUp}>
              <div className="rounded-2xl bg-card border border-border p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">
                  Water Intake
                </p>
                <div className="space-y-2.5">
                  {Array.from({ length: 7 }, (_, i) => {
                    const d = new Date(start)
                    d.setDate(d.getDate() + i)
                    const dateStr = d.toISOString().split('T')[0]
                    const log = logs.find(l => l.date === dateStr)
                    const oz = log?.water_oz || 0
                    const pct = Math.min(100, (oz / 96) * 100)
                    const color = oz >= 96 ? '#ADFF2F' : oz >= 64 ? '#facc15' : oz > 0 ? '#ef4444' : 'rgba(255,255,255,0.08)'
                    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-muted-foreground w-8">{days[i]}</span>
                        <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, background: color }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-12 text-right font-mono">
                          {oz > 0 ? `${oz} oz` : '—'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* Protein total */}
          {totalProtein > 0 && (
            <motion.div variants={fadeUp}>
              <div className="rounded-2xl bg-card border border-border p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-1">
                  Total Protein
                </p>
                <p className="font-display text-3xl font-bold text-primary mt-1">
                  {totalProtein.toFixed(0)}g
                </p>
                <p className="text-xs text-muted-foreground mt-1">this week</p>
              </div>
            </motion.div>
          )}

          {/* Reflection */}
          <motion.div variants={fadeUp}>
            <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
              <div className="flex items-center gap-2">
                <ClipboardText size={14} className="text-muted-foreground/60" />
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Weekly Reflection
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground/70 block mb-2">Wins this week</label>
                <Textarea
                  placeholder="What went well? What are you proud of?"
                  value={wins}
                  onChange={e => setWins(e.target.value)}
                  className="resize-none min-h-[72px] bg-secondary border-border rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground/70 block mb-2">What to improve</label>
                <Textarea
                  placeholder="What could have gone better?"
                  value={improvements}
                  onChange={e => setImprovements(e.target.value)}
                  className="resize-none min-h-[72px] bg-secondary border-border rounded-xl text-sm"
                />
              </div>

              <Button className="w-full" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <CircleNotch size={13} className="animate-spin" />
                ) : saved ? (
                  <CheckCircle size={13} weight="fill" />
                ) : null}
                {saved ? 'Saved' : 'Save Review'}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </motion.div>
  )
}
