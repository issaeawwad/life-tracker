import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { todayISO } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Barbell,
  Plus,
  Trash,
  CircleNotch,
  Flame,
  Clock,
  CheckCircle,
  SealCheck,
  CaretLeft,
  CaretRight,
} from '@phosphor-icons/react'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_CARDS = [
  {
    type: 'Strength',
    desc: 'Build muscle & power',
    bg: 'linear-gradient(160deg, #3d1515 0%, #200d0d 60%, #0a0a0a 100%)',
    glow: 'rgba(239,68,68,0.1)',
  },
  {
    type: 'Cardio',
    desc: 'Endurance & burn',
    bg: 'linear-gradient(160deg, #3d2410 0%, #201308 60%, #0a0a0a 100%)',
    glow: 'rgba(249,115,22,0.1)',
  },
  {
    type: 'Mobility',
    desc: 'Move & flex better',
    bg: 'linear-gradient(160deg, #0f3520 0%, #081e12 60%, #0a0a0a 100%)',
    glow: 'rgba(173,255,47,0.1)',
  },
  {
    type: 'Rehab',
    desc: 'Recover smart',
    bg: 'linear-gradient(160deg, #101535 0%, #080e20 60%, #0a0a0a 100%)',
    glow: 'rgba(96,165,250,0.1)',
  },
]

const TYPE_COLOR = {
  Strength: '#ef4444',
  Cardio: '#f97316',
  Mobility: '#ADFF2F',
  Rehab: '#60a5fa',
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWeekDates() {
  const today = new Date()
  const day = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((day + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().split('T')[0]
  })
}

function calculateStreak(workouts) {
  const dates = new Set(workouts.map(w => w.date))
  const today = todayISO()
  let check = new Date(today)
  if (!dates.has(today)) check.setDate(check.getDate() - 1)
  let streak = 0
  while (true) {
    const s = check.toISOString().split('T')[0]
    if (dates.has(s)) { streak++; check.setDate(check.getDate() - 1) }
    else break
  }
  return streak
}

// ─── Weekly summary ───────────────────────────────────────────────────────────

function WeeklySummary({ workouts }) {
  const weekDates = getWeekDates()
  const today = todayISO()
  const dateSet = new Set(workouts.map(w => w.date))
  const weekWorkouts = workouts.filter(w => weekDates.includes(w.date))
  const totalMins = weekWorkouts.reduce((s, w) => s + (w.duration_min || 0), 0)
  const streak = calculateStreak(workouts)
  const hours = Math.floor(totalMins / 60)
  const mins = totalMins % 60

  return (
    <div className="rounded-2xl bg-card border border-border p-5">
      <div className="grid grid-cols-3 divide-x divide-border mb-5">
        {[
          { label: 'This Week', value: weekWorkouts.length, sub: 'workouts' },
          {
            label: 'Volume',
            value: totalMins > 0 ? (hours > 0 ? `${hours}h ${mins}m` : `${totalMins}m`) : '—',
            sub: 'total time',
          },
          { label: 'Streak', value: streak, sub: 'days', streak: true },
        ].map(({ label, value, sub, streak: isStreak }) => (
          <div key={label} className="px-4 first:pl-0 last:pr-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-1">
              {label}
            </p>
            <div className="flex items-baseline gap-1">
              <p className="font-display text-3xl font-bold text-foreground">{value}</p>
              {isStreak && streak > 0 && (
                <Flame size={15} className="text-orange-400 mb-0.5" weight="fill" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* 7-day consistency dots */}
      <div className="flex gap-1.5">
        {weekDates.map((date, i) => {
          const logged = dateSet.has(date)
          const isToday = date === today
          const isFuture = date > today
          return (
            <div key={date} className="flex-1 flex flex-col items-center gap-1.5">
              <div
                className={`w-full aspect-square rounded-lg flex items-center justify-center transition-all ${
                  logged
                    ? 'bg-primary text-primary-foreground'
                    : isFuture
                    ? 'border border-border/30 bg-transparent'
                    : 'border border-border bg-secondary'
                } ${isToday && !logged ? 'ring-1 ring-primary/50 ring-offset-1 ring-offset-background' : ''}`}
                style={logged ? { boxShadow: '0 0 10px rgba(173,255,47,0.25)' } : undefined}
              >
                {logged && <CheckCircle size={13} weight="fill" />}
              </div>
              <span className={`text-[10px] font-semibold ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                {DAY_LABELS[i]}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Workout form ─────────────────────────────────────────────────────────────

function WorkoutForm({ selectedType, onAdd }) {
  const [type, setType] = useState(selectedType || 'Strength')
  const [date, setDate] = useState(todayISO())
  const [duration, setDuration] = useState('')
  const [rpe, setRpe] = useState(null)
  const [rehabSafe, setRehabSafe] = useState(false)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (selectedType) setType(selectedType) }, [selectedType])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!duration) return
    setSaving(true)
    await onAdd({ type, date, duration_min: parseInt(duration), rpe, rehab_safe: rehabSafe, notes })
    setDuration('')
    setRpe(null)
    setNotes('')
    setSaving(false)
  }

  const rpeColor = (n) =>
    n <= 3 ? 'text-health-green border-health-green bg-health-green/10'
    : n <= 6 ? 'text-health-yellow border-health-yellow bg-health-yellow/10'
    : 'text-health-red border-health-red bg-health-red/10'

  return (
    <div className="rounded-2xl bg-card border border-border p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">
        Log a Workout
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type pills */}
        <div className="flex flex-wrap gap-2">
          {CATEGORY_CARDS.map(({ type: t }) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                type === t
                  ? 'border-transparent text-black'
                  : 'border-border text-muted-foreground bg-secondary hover:border-primary/40'
              }`}
              style={type === t ? { background: TYPE_COLOR[t] } : undefined}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Date + Duration */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5 block font-semibold">
              Date
            </label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="bg-secondary border-border rounded-xl" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5 block font-semibold">
              Duration (min)
            </label>
            <Input type="number" placeholder="45" value={duration}
              onChange={e => setDuration(e.target.value)} min={1} max={600} required
              className="bg-secondary border-border rounded-xl" />
          </div>
        </div>

        {/* RPE picker */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
              RPE
            </label>
            {rpe && <span className="text-xs font-bold text-foreground">{rpe}/10</span>}
          </div>
          <div className="flex gap-1">
            {[1,2,3,4,5,6,7,8,9,10].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setRpe(rpe === n ? null : n)}
                className={`flex-1 h-8 rounded-lg text-xs font-bold border transition-all ${
                  rpe === n
                    ? rpeColor(n)
                    : 'border-border text-muted-foreground bg-secondary hover:border-primary/30'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>Easy</span><span>Max</span>
          </div>
        </div>

        {/* Rehab Safe slider toggle */}
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2 block font-semibold">
            Load Type
          </label>
          <button
            type="button"
            onClick={() => setRehabSafe(v => !v)}
            className="w-full flex items-center justify-between rounded-2xl bg-secondary border border-border px-4 py-3 transition-all hover:border-primary/30"
          >
            <div className="flex items-center gap-2.5">
              <motion.div
                animate={{ rotate: rehabSafe ? 0 : 15 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                {rehabSafe
                  ? <SealCheck size={16} weight="fill" className="text-sky-400" />
                  : <Barbell size={16} weight="fill" className="text-primary" />
                }
              </motion.div>
              <div className="text-left">
                <p className="text-xs font-semibold text-foreground">
                  {rehabSafe ? 'Rehab Safe' : 'Full Load'}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {rehabSafe ? 'Light / therapeutic movement' : 'Working at full intensity'}
                </p>
              </div>
            </div>
            {/* Pill slider track */}
            <div
              className="relative h-6 w-11 rounded-full transition-colors shrink-0"
              style={{ background: rehabSafe ? '#38bdf8' : '#ADFF2F' }}
            >
              <motion.div
                className="absolute top-0.5 h-5 w-5 rounded-full bg-black shadow"
                animate={{ left: rehabSafe ? 2 : 22 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </div>
          </button>
        </div>

        {/* Notes */}
        <Textarea
          placeholder="Notes (exercises, sets, how you felt...)"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className="resize-none min-h-[64px] bg-secondary border-border rounded-xl text-sm"
        />

        <Button type="submit" className="w-full" disabled={!duration || saving}>
          {saving ? <CircleNotch size={14} className="animate-spin" /> : <Plus size={14} />}
          Log Workout
        </Button>
      </form>
    </div>
  )
}

// ─── Workout row ──────────────────────────────────────────────────────────────

function WorkoutRow({ workout, onDelete }) {
  const [deleting, setDeleting] = useState(false)
  const color = TYPE_COLOR[workout.type] || '#8A8A8A'
  const rpeColor = !workout.rpe ? '' :
    workout.rpe <= 3 ? 'text-health-green' :
    workout.rpe <= 6 ? 'text-health-yellow' :
    'text-health-red'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 hover:border-white/10 transition-colors"
    >
      {/* Type indicator */}
      <div
        className="mt-0.5 h-8 w-1 rounded-full shrink-0"
        style={{ background: color }}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <p className="text-sm font-semibold text-foreground">{workout.type}</p>
          {workout.rehab_safe && (
            <span className="text-[10px] font-semibold text-sky-400 flex items-center gap-0.5">
              <SealCheck size={10} weight="fill" /> Rehab
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {workout.duration_min} min
          </span>
          {workout.rpe && (
            <span className={`font-semibold ${rpeColor}`}>RPE {workout.rpe}</span>
          )}
          <span className="ml-auto">{workout.date}</span>
        </div>
        {workout.notes && (
          <p className="text-xs text-muted-foreground/70 mt-1.5 line-clamp-2">{workout.notes}</p>
        )}
      </div>

      <button
        onClick={async () => { setDeleting(true); await onDelete(workout.id) }}
        disabled={deleting}
        className="text-muted-foreground/40 hover:text-destructive transition-colors mt-0.5 shrink-0 p-1"
      >
        {deleting ? <CircleNotch size={13} className="animate-spin" /> : <Trash size={13} />}
      </button>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] } },
}

export default function Workouts() {
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedType, setSelectedType] = useState(null)
  const formRef = useRef(null)

  const loadWorkouts = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const since = new Date()
    since.setDate(since.getDate() - 90)
    const { data } = await supabase
      .from('workouts')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', since.toISOString().split('T')[0])
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
    setWorkouts(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadWorkouts() }, [loadWorkouts])

  const addWorkout = async (workout) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const payload = {
      user_id: user.id,
      date: workout.date,
      type: workout.type,
      duration_min: workout.duration_min,
      notes: workout.notes || null,
    }
    try {
      await supabase.from('workouts').insert({ ...payload, rpe: workout.rpe, rehab_safe: workout.rehab_safe })
    } catch {
      await supabase.from('workouts').insert(payload)
    }
    await loadWorkouts()
  }

  const deleteWorkout = async (id) => {
    await supabase.from('workouts').delete().eq('id', id)
    setWorkouts(w => w.filter(x => x.id !== id))
  }

  const handleCategorySelect = (type) => {
    setSelectedType(prev => prev === type ? null : type)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
      className="space-y-5"
    >
      {/* Header */}
      <motion.div variants={fadeUp}>
        <h2 className="font-display text-2xl font-semibold text-foreground">Workouts</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Track your training</p>
      </motion.div>

      {/* ── Category cards (Apple Fitness+ style, arrow-navigable) ── */}
      <motion.div variants={fadeUp}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Category
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                const idx = CATEGORY_CARDS.findIndex(c => c.type === selectedType)
                const prev = CATEGORY_CARDS[(idx - 1 + CATEGORY_CARDS.length) % CATEGORY_CARDS.length]
                handleCategorySelect(prev.type)
              }}
              className="h-7 w-7 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
            >
              <CaretLeft size={12} />
            </button>
            <span className="text-[11px] font-semibold text-muted-foreground w-20 text-center">
              {selectedType
                ? `${CATEGORY_CARDS.findIndex(c => c.type === selectedType) + 1} / ${CATEGORY_CARDS.length}`
                : `${CATEGORY_CARDS.length} types`}
            </span>
            <button
              onClick={() => {
                const idx = CATEGORY_CARDS.findIndex(c => c.type === selectedType)
                const next = CATEGORY_CARDS[(idx + 1) % CATEGORY_CARDS.length]
                handleCategorySelect(next.type)
              }}
              className="h-7 w-7 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
            >
              <CaretRight size={12} />
            </button>
          </div>
        </div>

        {/* Scroll row — arrows AND touch-swipe both work */}
        <div className="relative">
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none snap-x snap-mandatory">
            {CATEGORY_CARDS.map((card) => (
              <button
                key={card.type}
                onClick={() => handleCategorySelect(card.type)}
                className={`shrink-0 w-36 h-44 rounded-2xl overflow-hidden relative text-left transition-all snap-start ${
                  selectedType === card.type
                    ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                    : 'hover:scale-[1.02]'
                }`}
                style={{ background: card.bg }}
              >
                <div
                  className="absolute inset-0"
                  style={{ background: `radial-gradient(ellipse at 30% 25%, ${card.glow} 0%, transparent 65%)` }}
                />
                <div className="absolute inset-0 flex flex-col justify-end p-4">
                  <p className="font-display text-base font-bold text-white leading-tight">{card.type}</p>
                  <p className="text-[11px] text-white/45 mt-0.5">{card.desc}</p>
                </div>
                {selectedType === card.type && (
                  <div
                    className="absolute top-2.5 right-2.5 h-5 w-5 rounded-full flex items-center justify-center"
                    style={{ background: '#ADFF2F' }}
                  >
                    <CheckCircle size={12} weight="fill" className="text-black" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Dot indicators */}
        <div className="flex justify-center gap-1.5 mt-3">
          {CATEGORY_CARDS.map((card) => (
            <button
              key={card.type}
              onClick={() => handleCategorySelect(card.type)}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: selectedType === card.type ? '20px' : '6px',
                background: selectedType === card.type ? '#ADFF2F' : 'rgba(255,255,255,0.2)',
              }}
            />
          ))}
        </div>

        {/* Lime CTA */}
        <AnimatePresence>
          {selectedType && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-3"
            >
              <Button
                className="w-full"
                onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                Log {selectedType} Workout →
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Weekly summary ── */}
      <motion.div variants={fadeUp}>
        {loading ? (
          <div className="h-32 rounded-2xl border border-border bg-card flex items-center justify-center text-muted-foreground">
            <CircleNotch size={20} className="animate-spin" />
          </div>
        ) : (
          <WeeklySummary workouts={workouts} />
        )}
      </motion.div>

      {/* ── Log form ── */}
      <motion.div variants={fadeUp} ref={formRef}>
        <WorkoutForm selectedType={selectedType} onAdd={addWorkout} />
      </motion.div>

      {/* ── Recent workouts ── */}
      <motion.div variants={fadeUp}>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-3">
          Recent
        </p>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <CircleNotch size={20} className="animate-spin" />
          </div>
        ) : workouts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
            <Barbell size={28} className="opacity-15" />
            <p className="text-sm opacity-40">No workouts logged yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {workouts.slice(0, 20).map(w => (
              <WorkoutRow key={w.id} workout={w} onDelete={deleteWorkout} />
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
