import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ForkKnife, Plus, Trash, CircleNotch, CaretLeft, CaretRight,
  ShoppingCart, X, Sparkle,
} from '@phosphor-icons/react'

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack']
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const MEAL_DOT = {
  Breakfast: '#facc15',
  Lunch:     '#4ade80',
  Dinner:    '#a78bfa',
  Snack:     '#38bdf8',
}

function getWeekDates(offset = 0) {
  const today = new Date()
  const day = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((day + 6) % 7) + offset * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().split('T')[0]
  })
}

function formatWeekRange(dates) {
  const fmt = (iso) => { const [,m,d] = iso.split('-'); return `${parseInt(m)}/${parseInt(d)}` }
  return `${fmt(dates[0])} – ${fmt(dates[6])}`
}

// ─── Meal Cell ────────────────────────────────────────────────────────────────

function MealCell({ meals, mealType, onClick }) {
  const dot = MEAL_DOT[mealType]
  return (
    <button
      onClick={onClick}
      className={`w-full min-h-[52px] rounded-xl border text-left p-2 transition-all group ${
        meals.length > 0
          ? 'border-border/60 bg-secondary/60 hover:border-primary/30'
          : 'border-dashed border-border/30 bg-transparent hover:border-primary/25 hover:bg-primary/3'
      }`}
    >
      {meals.length > 0 ? (
        <div className="space-y-0.5">
          {meals.map(m => (
            <div key={m.id} className="flex items-center gap-1">
              <div className="h-1 w-1 rounded-full shrink-0" style={{ background: dot }} />
              <p className="text-[11px] leading-tight text-foreground/75 truncate">{m.name}</p>
            </div>
          ))}
          {meals.some(m => m.calories) && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {meals.reduce((s, m) => s + (m.calories || 0), 0)} kcal
            </p>
          )}
        </div>
      ) : (
        <Plus size={11} className="text-muted-foreground/25 group-hover:text-primary/35 mt-0.5 ml-0.5" />
      )}
    </button>
  )
}

// ─── Meal Modal ───────────────────────────────────────────────────────────────

function MealModal({ cell, meals, onAdd, onDelete, onClose }) {
  const [name, setName] = useState('')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await onAdd({
      date: cell.date,
      meal_type: cell.mealType,
      name: name.trim(),
      calories: calories ? parseInt(calories) : null,
      protein_g: protein ? parseFloat(protein) : null,
      notes: notes.trim() || null,
    })
    setName('')
    setCalories('')
    setProtein('')
    setNotes('')
    setSaving(false)
  }

  const dot = MEAL_DOT[cell.mealType]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        className="relative w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl z-10"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full" style={{ background: dot }} />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
                {cell.mealType}
              </p>
              <p className="text-sm font-semibold text-foreground">{cell.date}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1.5 rounded-xl hover:bg-secondary transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {meals.length > 0 && (
          <div className="px-5 pb-3 space-y-2">
            {meals.map(m => (
              <div key={m.id} className="flex items-start gap-2 rounded-xl border border-border bg-secondary/50 p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{m.name}</p>
                  <div className="flex gap-2 text-[11px] text-muted-foreground mt-0.5">
                    {m.calories && <span>{m.calories} kcal</span>}
                    {m.protein_g && <span>{m.protein_g}g protein</span>}
                    {m.notes && <span className="truncate opacity-70">{m.notes}</span>}
                  </div>
                </div>
                <button
                  onClick={() => onDelete(m.id)}
                  className="text-muted-foreground/40 hover:text-destructive transition-colors p-0.5 shrink-0"
                >
                  <Trash size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleAdd} className="px-5 pb-5 space-y-3">
          <div className="h-px bg-border/50 -mx-5" />
          <Input
            placeholder="What did you eat?"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            required
            className="bg-secondary border-border rounded-xl"
          />
          <div className="flex gap-2">
            <Input type="number" placeholder="Calories" value={calories}
              onChange={e => setCalories(e.target.value)} className="flex-1 bg-secondary border-border rounded-xl" min={0} />
            <Input type="number" placeholder="Protein (g)" value={protein}
              onChange={e => setProtein(e.target.value)} className="flex-1 bg-secondary border-border rounded-xl" min={0} step={0.1} />
          </div>
          <Input placeholder="Notes (optional)" value={notes}
            onChange={e => setNotes(e.target.value)} className="bg-secondary border-border rounded-xl" />
          <Button type="submit" className="w-full" disabled={!name.trim() || saving}>
            {saving ? <CircleNotch size={13} className="animate-spin" /> : <Plus size={13} />}
            Add to {cell.mealType}
          </Button>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Grocery List Modal ───────────────────────────────────────────────────────

function GroceryListModal({ groceryList, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl z-10 max-h-[80vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0 border-b border-border/50">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center"
              style={{ boxShadow: '0 0 14px rgba(173,255,47,0.3)' }}>
              <ShoppingCart size={15} className="text-primary-foreground" />
            </div>
            <h3 className="font-display text-base font-semibold text-foreground">Grocery List</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1.5 rounded-xl hover:bg-secondary transition-colors">
            <X size={15} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 space-y-0.5">
          {groceryList.split('\n').map((line, i) => {
            if (!line.trim()) return <div key={i} className="h-2" />
            const isHeader = /^[🥬🥩🥛🌾🫙]|^#+\s|^\*\*/.test(line.trim())
            const isBullet = /^[-•]/.test(line.trim())
            if (isHeader) return (
              <p key={i} className="text-sm font-bold text-primary mt-4 first:mt-0">
                {line.replace(/^#+\s*/, '').replace(/\*\*/g, '')}
              </p>
            )
            if (isBullet) return (
              <p key={i} className="text-sm text-foreground/75 pl-3">
                {line.replace(/^[-•]\s*/, '– ')}
              </p>
            )
            return <p key={i} className="text-sm text-muted-foreground">{line}</p>
          })}
        </div>
      </motion.div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Meals() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [meals, setMeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCell, setActiveCell] = useState(null)
  const [groceryList, setGroceryList] = useState(null)
  const [generatingList, setGeneratingList] = useState(false)

  const weekDates = getWeekDates(weekOffset)

  const loadMeals = useCallback(async (dates) => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('meals').select('*').eq('user_id', user.id)
      .gte('date', dates[0]).lte('date', dates[6])
      .order('created_at', { ascending: true })
    setMeals(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadMeals(weekDates) }, [weekOffset])

  const mealsByKey = meals.reduce((acc, m) => {
    const key = `${m.date}_${m.meal_type}`
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  const addMeal = async (meal) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('meals').insert({ ...meal, user_id: user.id }).select().single()
    if (data) setMeals(prev => [...prev, data])
  }

  const deleteMeal = async (id) => {
    await supabase.from('meals').delete().eq('id', id)
    setMeals(prev => prev.filter(m => m.id !== id))
  }

  const generateGroceryList = async () => {
    setGeneratingList(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const payload = meals.map(m => ({
        day: DAY_LABELS[weekDates.indexOf(m.date)] ?? m.date,
        meal_type: m.meal_type,
        name: m.name,
        calories: m.calories,
        protein_g: m.protein_g,
      }))
      const res = await fetch('/api/grocery-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ meals: payload }),
      })
      const json = await res.json()
      if (json.groceryList) setGroceryList(json.groceryList)
    } finally {
      setGeneratingList(false)
    }
  }

  const today = new Date().toISOString().split('T')[0]
  const totalCal = meals.reduce((s, m) => s + (m.calories || 0), 0)
  const totalPro = meals.reduce((s, m) => s + (m.protein_g || 0), 0)
  const daysLogged = new Set(meals.map(m => m.date)).size

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-foreground">Meals</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Weekly nutrition grid</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={generateGroceryList}
          disabled={meals.length === 0 || generatingList}
          className="shrink-0"
        >
          {generatingList
            ? <CircleNotch size={13} className="animate-spin" />
            : <Sparkle size={13} />
          }
          Grocery List
        </Button>
      </div>

      {/* Week nav */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setWeekOffset(o => o - 1)}
          className="h-8 w-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
        >
          <CaretLeft size={13} />
        </button>
        <p className="text-sm font-semibold text-foreground flex-1 text-center">
          {weekOffset === 0 ? 'This Week' : weekOffset === -1 ? 'Last Week' : formatWeekRange(weekDates)}
          {' '}
          <span className="text-muted-foreground font-normal text-xs">({formatWeekRange(weekDates)})</span>
        </p>
        <button
          onClick={() => setWeekOffset(o => o + 1)}
          disabled={weekOffset >= 0}
          className="h-8 w-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all disabled:opacity-25 disabled:cursor-not-allowed"
        >
          <CaretRight size={13} />
        </button>
      </div>

      {/* Weekly totals */}
      {meals.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: 'Calories', value: totalCal.toLocaleString(), unit: 'kcal', color: '#facc15' },
            { label: 'Protein', value: `${totalPro.toFixed(0)}g`, unit: 'total', color: '#ADFF2F' },
            { label: 'Days', value: `${daysLogged}/7`, unit: 'logged', color: '#4ade80' },
          ].map(({ label, value, unit, color }) => (
            <div
              key={label}
              className="rounded-2xl bg-card border border-border p-4"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{label}</p>
              <p className="font-display text-xl font-bold mt-1 leading-none" style={{ color }}>{value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{unit}</p>
            </div>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[56px_1fr_1fr_1fr_1fr] border-b border-border">
          <div className="p-2" />
          {MEAL_TYPES.map(t => (
            <div key={t} className="p-2 text-center border-l border-border/50">
              <div className="flex items-center justify-center gap-1">
                <div className="h-1.5 w-1.5 rounded-full" style={{ background: MEAL_DOT[t] }} />
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{t}</p>
              </div>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-14 text-muted-foreground">
            <CircleNotch size={20} className="animate-spin mr-2" /> Loading...
          </div>
        ) : (
          weekDates.map((date, i) => {
            const isToday = date === today
            const dayMeals = meals.filter(m => m.date === date)
            const dayCal = dayMeals.reduce((s, m) => s + (m.calories || 0), 0)
            const dayPro = dayMeals.reduce((s, m) => s + (m.protein_g || 0), 0)

            return (
              <div
                key={date}
                className={`grid grid-cols-[56px_1fr_1fr_1fr_1fr] border-b border-border/40 last:border-0 ${
                  isToday ? 'bg-primary/[0.03]' : ''
                }`}
              >
                <div className={`p-2 flex flex-col justify-between ${isToday ? 'bg-primary/[0.05]' : ''}`}>
                  <div>
                    <p className={`text-xs font-bold ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                      {DAY_LABELS[i]}
                    </p>
                    <p className="text-[10px] text-muted-foreground/50">{date.slice(5).replace('-', '/')}</p>
                  </div>
                  {dayMeals.length > 0 && (
                    <div className="mt-1.5">
                      {dayCal > 0 && <p className="text-[9px] font-semibold" style={{ color: '#facc15', opacity: 0.8 }}>{dayCal}</p>}
                      {dayPro > 0 && <p className="text-[9px] font-semibold text-primary/70">{dayPro.toFixed(0)}g</p>}
                    </div>
                  )}
                </div>
                {MEAL_TYPES.map(mealType => (
                  <div key={mealType} className="p-1.5 border-l border-border/30">
                    <MealCell
                      meals={mealsByKey[`${date}_${mealType}`] || []}
                      mealType={mealType}
                      onClick={() => setActiveCell({ date, mealType })}
                    />
                  </div>
                ))}
              </div>
            )
          })
        )}
      </div>

      <AnimatePresence>
        {activeCell && (
          <MealModal
            key="meal-modal"
            cell={activeCell}
            meals={mealsByKey[`${activeCell.date}_${activeCell.mealType}`] || []}
            onAdd={addMeal}
            onDelete={deleteMeal}
            onClose={() => setActiveCell(null)}
          />
        )}
        {groceryList && (
          <GroceryListModal
            key="grocery-modal"
            groceryList={groceryList}
            onClose={() => setGroceryList(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
