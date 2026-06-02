import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { todayISO, nowPST } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Plus, Trash, CircleNotch, CaretLeft, CaretRight,
} from '@phosphor-icons/react'

// ─── Constants ────────────────────────────────────────────────────────────────

const BLOCK_TYPES = ['Work', 'Exercise', 'Meeting', 'Personal', 'Learning', 'Rest', 'Other']

const TYPE_COLORS = {
  Work:     '#60a5fa',
  Exercise: '#ADFF2F',
  Meeting:  '#facc15',
  Personal: '#f472b6',
  Learning: '#a78bfa',
  Rest:     '#94a3b8',
  Other:    '#6b7280',
}

const VIEWS     = ['day', 'week', 'month']
const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const HOUR_START = 6
const HOUR_END   = 22

// ─── Date helpers (timezone-safe) ────────────────────────────────────────────

function dateToISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isoToDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function getWeekDates(iso) {
  const d = isoToDate(iso)
  const offset = (d.getDay() + 6) % 7
  return Array.from({ length: 7 }, (_, i) =>
    dateToISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset + i))
  )
}

function navigate(view, iso, dir) {
  const d = isoToDate(iso)
  if (view === 'day')   return dateToISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + dir))
  if (view === 'week')  return dateToISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + dir * 7))
  if (view === 'month') return dateToISO(new Date(d.getFullYear(), d.getMonth() + dir, 1))
}

function getDateRange(view, iso) {
  if (view === 'day') return { from: iso, to: iso }
  if (view === 'week') {
    const w = getWeekDates(iso)
    return { from: w[0], to: w[6] }
  }
  const d = isoToDate(iso)
  const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  const to = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { from, to }
}

function navLabel(view, iso) {
  const d = isoToDate(iso)
  const fmt = (date, opts) => date.toLocaleDateString('en-US', opts)
  if (view === 'day')
    return fmt(d, { weekday: 'long', month: 'short', day: 'numeric' })
  if (view === 'week') {
    const w = getWeekDates(iso)
    const s = fmt(isoToDate(w[0]), { month: 'short', day: 'numeric' })
    const e = fmt(isoToDate(w[6]), { month: 'short', day: 'numeric' })
    return `${s} – ${e}`
  }
  return fmt(d, { month: 'long', year: 'numeric' })
}

function formatHour(h) {
  if (h === 12) return '12 PM'
  if (h === 0 || h === 24) return '12 AM'
  return h > 12 ? `${h - 12} PM` : `${h} AM`
}

// ─── Federal holidays ─────────────────────────────────────────────────────────

function getObservedISO(year, month0, day) {
  const d = new Date(year, month0, day)
  const dow = d.getDay()
  if (dow === 6) d.setDate(d.getDate() - 1) // Sat → Fri
  else if (dow === 0) d.setDate(d.getDate() + 1) // Sun → Mon
  return dateToISO(d)
}

function getNthWeekday(year, month0, dow, n) {
  if (n > 0) {
    const d = new Date(year, month0, 1)
    let count = 0
    while (d.getMonth() === month0) {
      if (d.getDay() === dow && ++count === n) return dateToISO(d)
      d.setDate(d.getDate() + 1)
    }
  } else {
    const d = new Date(year, month0 + 1, 0)
    let count = 0
    while (d.getMonth() === month0) {
      if (d.getDay() === dow && ++count === -n) return dateToISO(d)
      d.setDate(d.getDate() - 1)
    }
  }
  return null
}

function getFederalHolidays(year) {
  const h = {}
  const set = (iso, name) => { if (iso) h[iso] = name }
  set(getObservedISO(year, 0, 1),          "New Year's Day")
  set(getNthWeekday(year, 0, 1, 3),        'MLK Jr. Day')
  set(getNthWeekday(year, 1, 1, 3),        "Presidents' Day")
  set(getNthWeekday(year, 4, 1, -1),       'Memorial Day')
  set(getObservedISO(year, 5, 19),         'Juneteenth')
  set(getObservedISO(year, 6, 4),          'Independence Day')
  set(getNthWeekday(year, 8, 1, 1),        'Labor Day')
  set(getNthWeekday(year, 9, 1, 2),        'Columbus Day')
  set(getObservedISO(year, 10, 11),        'Veterans Day')
  set(getNthWeekday(year, 10, 4, 4),       'Thanksgiving')
  set(getObservedISO(year, 11, 25),        'Christmas Day')
  return h
}

// ─── Segmented control ────────────────────────────────────────────────────────

function SegmentedControl({ value, onChange }) {
  const idx = VIEWS.indexOf(value)
  return (
    <div className="relative flex bg-secondary rounded-full p-1 select-none">
      <motion.div
        className="absolute top-1 bottom-1 rounded-full bg-primary"
        style={{ boxShadow: '0 0 14px rgba(173,255,47,0.3)' }}
        animate={{ left: `calc(${idx} * 33.333% + 4px)`, width: 'calc(33.333% - 8px)' }}
        transition={{ type: 'spring', stiffness: 420, damping: 36 }}
      />
      {VIEWS.map((v, i) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className="relative z-10 flex-1 py-2 text-[11px] font-bold uppercase tracking-widest transition-colors"
          style={{ color: idx === i ? '#000' : '#8A8A8A' }}
        >
          {v}
        </button>
      ))}
    </div>
  )
}

// ─── Holiday banner ───────────────────────────────────────────────────────────

function HolidayBanner({ name }) {
  return (
    <div
      className="flex items-center gap-2.5 rounded-xl px-4 py-2.5"
      style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)' }}
    >
      <span className="text-base leading-none">🇺🇸</span>
      <div>
        <p className="text-xs font-bold text-foreground">{name}</p>
        <p className="text-[10px] text-muted-foreground">Federal Holiday</p>
      </div>
    </div>
  )
}

// ─── Block chip ───────────────────────────────────────────────────────────────

function BlockChip({ block, onDelete }) {
  const color = TYPE_COLORS[block.block_type] || '#6b7280'
  const duration = block.start_time && block.end_time
    ? (() => {
        const [sh, sm] = block.start_time.split(':').map(Number)
        const [eh, em] = block.end_time.split(':').map(Number)
        const m = (eh * 60 + em) - (sh * 60 + sm)
        if (m <= 0) return null
        return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`
      })()
    : null

  return (
    <div
      className="flex items-center gap-2 rounded-xl px-3 py-2 group"
      style={{ background: `${color}14`, border: `1px solid ${color}28` }}
    >
      <div className="h-5 w-0.5 rounded-full shrink-0" style={{ background: color }} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground truncate">{block.title}</p>
        {block.end_time && (
          <p className="text-[10px] text-muted-foreground">
            {block.start_time} – {block.end_time}
            {duration && <span className="ml-1 opacity-60">{duration}</span>}
          </p>
        )}
      </div>
      <button
        onClick={() => onDelete(block.id)}
        className="text-muted-foreground/25 hover:text-destructive transition-colors p-0.5 shrink-0 opacity-0 group-hover:opacity-100"
      >
        <Trash size={11} />
      </button>
    </div>
  )
}

// ─── Daily view ───────────────────────────────────────────────────────────────

function DailyView({ blocks, selectedDate, holidays, onDelete }) {
  const nowRef = useRef(null)
  const isToday = selectedDate === todayISO()
  const now = nowPST()
  const currentHour = now.getHours()
  const currentMin  = now.getMinutes()
  const holidayName = holidays[selectedDate]

  useEffect(() => {
    if (isToday && nowRef.current)
      setTimeout(() => nowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)
  }, [isToday])

  const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => i + HOUR_START)
  const unscheduled = blocks.filter(b => !b.start_time)

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      {/* Holiday banner */}
      {holidayName && (
        <div className="px-4 py-3 border-b border-border/40">
          <HolidayBanner name={holidayName} />
        </div>
      )}

      <div className="divide-y divide-border/30">
        {hours.map(h => {
          const isCurrentHour = isToday && currentHour === h
          const blocksHere = blocks.filter(
            b => b.start_time && parseInt(b.start_time.split(':')[0]) === h
          )
          return (
            <div
              key={h}
              ref={isCurrentHour ? nowRef : undefined}
              className={`flex min-h-[56px] ${isCurrentHour ? 'bg-primary/[0.04]' : ''}`}
            >
              <div className="w-16 shrink-0 flex items-start justify-end pt-3 pr-3">
                <span className={`text-[11px] font-semibold font-mono ${isCurrentHour ? 'text-primary' : 'text-muted-foreground/40'}`}>
                  {formatHour(h)}
                </span>
              </div>
              <div className="flex-1 py-2 pr-3 space-y-1.5">
                {isCurrentHour && (
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="h-2 w-2 rounded-full bg-primary" style={{ boxShadow: '0 0 6px rgba(173,255,47,0.8)' }} />
                    <div className="h-px flex-1 bg-primary/35" />
                    <span className="text-[10px] font-bold text-primary">
                      {String(currentHour).padStart(2,'0')}:{String(currentMin).padStart(2,'0')}
                    </span>
                  </div>
                )}
                {blocksHere.map(b => <BlockChip key={b.id} block={b} onDelete={onDelete} />)}
              </div>
            </div>
          )
        })}
      </div>

      {unscheduled.length > 0 && (
        <div className="border-t border-border/40 p-4 space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-2">
            Unscheduled
          </p>
          {unscheduled.map(b => <BlockChip key={b.id} block={b} onDelete={onDelete} />)}
        </div>
      )}

      {blocks.length === 0 && !holidayName && (
        <div className="flex items-center justify-center py-12 text-muted-foreground/30 text-sm">
          No blocks scheduled
        </div>
      )}
    </div>
  )
}

// ─── Weekly view ──────────────────────────────────────────────────────────────

function WeeklyView({ blocks, selectedDate, holidays, onSelectDate, onDelete }) {
  const today = todayISO()
  const weekDates = getWeekDates(selectedDate)

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="grid grid-cols-7">
          {weekDates.map((date, i) => {
            const isToday    = date === today
            const isSelected = date === selectedDate
            const dayBlocks  = blocks.filter(b => b.date === date)
            const dayNum     = parseInt(date.split('-')[2])
            const isHoliday  = !!holidays[date]

            return (
              <button
                key={date}
                onClick={() => onSelectDate(date)}
                className={`flex flex-col items-center gap-1 py-3 transition-all ${
                  isSelected ? 'bg-primary/10' : 'hover:bg-secondary/40'
                }`}
              >
                <span className={`text-[10px] font-bold uppercase tracking-widest ${
                  isSelected ? 'text-primary' : 'text-muted-foreground'
                }`}>
                  {DAY_LETTERS[i]}
                </span>
                <span
                  className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full transition-all ${
                    isToday
                      ? 'bg-primary text-primary-foreground'
                      : isSelected ? 'text-primary' : 'text-foreground'
                  }`}
                  style={isToday ? { boxShadow: '0 0 10px rgba(173,255,47,0.35)' } : undefined}
                >
                  {dayNum}
                </span>
                {/* Block dots */}
                <div className="flex gap-0.5 h-1.5">
                  {dayBlocks.slice(0, 3).map((b, bi) => (
                    <div key={bi} className="h-1.5 w-1.5 rounded-full"
                      style={{ background: TYPE_COLORS[b.block_type] || '#6b7280' }} />
                  ))}
                </div>
                {/* Holiday flag */}
                {isHoliday && (
                  <span className="text-[10px] leading-none">🇺🇸</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected day blocks */}
      {holidays[selectedDate] && (
        <HolidayBanner name={holidays[selectedDate]} />
      )}
      <div className="space-y-2">
        {blocks
          .filter(b => b.date === selectedDate)
          .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
          .map(b => <BlockChip key={b.id} block={b} onDelete={onDelete} />)}
        {blocks.filter(b => b.date === selectedDate).length === 0 && !holidays[selectedDate] && (
          <p className="text-center text-sm text-muted-foreground/35 py-6">No blocks for this day</p>
        )}
      </div>
    </div>
  )
}

// ─── Monthly view ─────────────────────────────────────────────────────────────

function MonthlyView({ blocks, selectedDate, holidays, onSelectDate, onDelete }) {
  const today = todayISO()
  const d = isoToDate(selectedDate)
  const year = d.getFullYear()
  const month = d.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7

  const blocksByDate = blocks.reduce((acc, b) => {
    if (!acc[b.date]) acc[b.date] = []
    acc[b.date].push(b)
    return acc
  }, {})

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {['M','T','W','T','F','S','S'].map((l, i) => (
            <div key={i} className="py-2.5 text-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{l}</span>
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 p-2 gap-1">
          {Array.from({ length: firstDayOfWeek }, (_, i) => (
            <div key={`e${i}`} className="aspect-square" />
          ))}

          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1
            const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const isToday    = iso === today
            const isSelected = iso === selectedDate
            const dayBlocks  = blocksByDate[iso] || []
            const isHoliday  = !!holidays[iso]

            return (
              <button
                key={day}
                onClick={() => onSelectDate(iso)}
                className={`aspect-square flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all text-sm font-semibold ${
                  isSelected
                    ? 'bg-primary text-primary-foreground'
                    : isToday
                    ? 'bg-primary/15 text-primary'
                    : 'text-foreground hover:bg-secondary/60'
                }`}
                style={isSelected ? { boxShadow: '0 0 12px rgba(173,255,47,0.3)' } : undefined}
              >
                <span>{day}</span>
                <div className="flex gap-0.5 items-center">
                  {/* Holiday dot */}
                  {isHoliday && (
                    <div
                      className="h-1 w-1 rounded-full"
                      style={{ background: isSelected ? 'rgba(0,0,0,0.45)' : '#ef4444' }}
                    />
                  )}
                  {/* Block dots */}
                  {dayBlocks.slice(0, isHoliday ? 2 : 3).map((b, bi) => (
                    <div key={bi} className="h-1 w-1 rounded-full"
                      style={{ background: isSelected ? 'rgba(0,0,0,0.45)' : (TYPE_COLORS[b.block_type] || '#6b7280') }} />
                  ))}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected day detail */}
      {(() => {
        const dayBlocks = (blocksByDate[selectedDate] || [])
          .slice().sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
        const [sy, sm, sd] = selectedDate.split('-').map(Number)
        const label = new Date(sy, sm - 1, sd)
          .toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })

        return (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2">
              {label}
            </p>
            <div className="space-y-2">
              {holidays[selectedDate] && (
                <HolidayBanner name={holidays[selectedDate]} />
              )}
              {dayBlocks.length > 0
                ? dayBlocks.map(b => <BlockChip key={b.id} block={b} onDelete={onDelete} />)
                : !holidays[selectedDate] && (
                  <p className="text-center text-sm text-muted-foreground/35 py-4">
                    No blocks scheduled
                  </p>
                )
              }
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ─── Block form ───────────────────────────────────────────────────────────────

function BlockForm({ selectedDate, onAdd }) {
  const [title, setTitle]         = useState('')
  const [type, setType]           = useState('Work')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime]     = useState('')
  const [saving, setSaving]       = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title) return
    setSaving(true)
    await onAdd({ title, block_type: type, start_time: startTime || null, end_time: endTime || null })
    setTitle('')
    setStartTime('')
    setEndTime('')
    setSaving(false)
  }

  return (
    <div className="rounded-2xl bg-card border border-border p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">
        Add Block
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {BLOCK_TYPES.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${
                type === t ? 'border-transparent text-black' : 'border-border text-muted-foreground bg-secondary hover:border-white/20'
              }`}
              style={type === t ? { background: TYPE_COLORS[t] } : undefined}
            >
              {t}
            </button>
          ))}
        </div>

        <Input
          placeholder="Block title (e.g. Deep work, Gym)"
          value={title}
          onChange={e => setTitle(e.target.value)}
          required
          className="bg-secondary border-border rounded-xl"
        />

        <div className="flex gap-2 items-center">
          <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
            className="flex-1 bg-secondary border-border rounded-xl" />
          <span className="text-muted-foreground text-sm">→</span>
          <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
            className="flex-1 bg-secondary border-border rounded-xl" />
          <Button type="submit" size="sm" disabled={!title || saving}>
            {saving ? <CircleNotch size={13} className="animate-spin" /> : <Plus size={13} />}
            Add
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground/45">
          Adding to {(() => {
            const [y, m, d] = selectedDate.split('-').map(Number)
            return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
          })()}
        </p>
      </form>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const fadeSwitch = {
  initial:    { opacity: 0, y: 10 },
  animate:    { opacity: 1, y: 0 },
  exit:       { opacity: 0, y: -6 },
  transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] },
}

export default function Schedule() {
  const [view, setView]               = useState('day')
  const [selectedDate, setSelectedDate] = useState(todayISO())
  const [blocks, setBlocks]           = useState([])
  const [loading, setLoading]         = useState(true)

  // Pre-compute federal holidays for 3 years around selected date
  const holidays = useMemo(() => {
    const year = isoToDate(selectedDate).getFullYear()
    return {
      ...getFederalHolidays(year - 1),
      ...getFederalHolidays(year),
      ...getFederalHolidays(year + 1),
    }
  }, [selectedDate])

  const loadBlocks = useCallback(async (from, to) => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('schedule_blocks').select('*')
      .eq('user_id', user.id).gte('date', from).lte('date', to)
      .order('start_time', { ascending: true })
    setBlocks(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    const { from, to } = getDateRange(view, selectedDate)
    loadBlocks(from, to)
  }, [view, selectedDate, loadBlocks])

  const handleNav = (dir) => setSelectedDate(prev => navigate(view, prev, dir))

  const addBlock = async (block) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('schedule_blocks')
      .insert({ ...block, user_id: user.id, date: selectedDate })
      .select().single()
    if (data)
      setBlocks(prev => [...prev, data].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')))
  }

  const deleteBlock = async (id) => {
    await supabase.from('schedule_blocks').delete().eq('id', id)
    setBlocks(prev => prev.filter(b => b.id !== id))
  }

  const isAtPresent = view === 'day'
    ? selectedDate === todayISO()
    : view === 'week'
    ? getWeekDates(selectedDate).includes(todayISO())
    : selectedDate.startsWith(todayISO().slice(0, 7))

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl font-semibold text-foreground">Schedule</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Plan your time</p>
      </div>

      <SegmentedControl value={view} onChange={setView} />

      {/* Navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleNav(-1)}
          className="h-8 w-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-white/20 transition-all"
        >
          <CaretLeft size={13} />
        </button>
        <motion.p
          key={navLabel(view, selectedDate)}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 text-center text-sm font-semibold text-foreground"
        >
          {navLabel(view, selectedDate)}
          {holidays[view === 'day' ? selectedDate : ''] && (
            <span className="ml-2 text-[10px] text-red-400 font-normal">🇺🇸</span>
          )}
        </motion.p>
        <button
          onClick={() => handleNav(1)}
          className="h-8 w-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-white/20 transition-all"
        >
          <CaretRight size={13} />
        </button>
        {!isAtPresent && (
          <Button variant="outline" size="sm" onClick={() => setSelectedDate(todayISO())} className="text-xs">
            Today
          </Button>
        )}
      </div>

      {/* Calendar views */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <CircleNotch size={20} className="animate-spin" />
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={view} {...fadeSwitch}>
            {view === 'day' && (
              <DailyView
                blocks={blocks.filter(b => b.date === selectedDate)}
                selectedDate={selectedDate}
                holidays={holidays}
                onDelete={deleteBlock}
              />
            )}
            {view === 'week' && (
              <WeeklyView
                blocks={blocks}
                selectedDate={selectedDate}
                holidays={holidays}
                onSelectDate={setSelectedDate}
                onDelete={deleteBlock}
              />
            )}
            {view === 'month' && (
              <MonthlyView
                blocks={blocks}
                selectedDate={selectedDate}
                holidays={holidays}
                onSelectDate={setSelectedDate}
                onDelete={deleteBlock}
              />
            )}
          </motion.div>
        </AnimatePresence>
      )}

      <BlockForm selectedDate={selectedDate} onAdd={addBlock} />
    </div>
  )
}
