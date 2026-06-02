import { motion, useSpring, useTransform } from 'framer-motion'
import { useEffect } from 'react'

const R = 84
const CX = 100
const CY = 100
const CIRC = Math.PI * R
const PATH = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`

function arcColor(score) {
  if (score == null) return '#444'
  if (score >= 85) return '#ADFF2F'
  if (score >= 60) return '#facc15'
  return '#ef4444'
}

function arcStatus(score) {
  if (score == null) return ''
  if (score >= 85) return 'OPTIMAL'
  if (score >= 70) return 'GOOD'
  if (score >= 50) return 'PAY ATTENTION'
  return 'REST'
}

function CountUp({ value, className }) {
  const spring = useSpring(0, { mass: 0.8, stiffness: 55, damping: 15 })
  const display = useTransform(spring, (n) => String(Math.round(n)))
  useEffect(() => { spring.set(value ?? 0) }, [spring, value])
  return <motion.span className={className}>{display}</motion.span>
}

/**
 * SVG semicircle arc gauge.
 * viewBox 200×120, arc from (16,100) to (184,100) going up, radius 84.
 * Parent controls width via className — height auto-scales to 60% of width.
 */
export function ArcGauge({
  score = 0,
  unit,
  showStatus = true,
  numberClassName = 'text-6xl',
}) {
  const pct = Math.min(Math.max(score ?? 0, 0), 100)
  const offset = CIRC * (1 - pct / 100)
  const color = arcColor(score)
  const status = arcStatus(score)

  return (
    <div className="relative w-full">
      <svg
        viewBox="0 0 200 120"
        className="w-full"
        style={{ height: 'auto', overflow: 'visible' }}
        aria-hidden="true"
      >
        {/* Track */}
        <path
          d={PATH}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={10}
          strokeLinecap="round"
        />

        {/* Glow layer */}
        <motion.path
          d={PATH}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          initial={{ strokeDashoffset: CIRC }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1], delay: 0.25 }}
          style={{ filter: 'blur(8px)', opacity: 0.55 }}
        />

        {/* Fill */}
        <motion.path
          d={PATH}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          initial={{ strokeDashoffset: CIRC }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1], delay: 0.25 }}
        />
      </svg>

      {/* Centered label overlay — sits inside the arc's interior */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pb-4">
        {score != null ? (
          <CountUp
            value={pct}
            className={`font-display font-bold text-foreground tabular-nums leading-none ${numberClassName}`}
          />
        ) : (
          <span className={`font-display font-bold text-muted-foreground leading-none ${numberClassName}`}>
            —
          </span>
        )}
        {unit && (
          <p className="text-[10px] text-white/35 mt-0.5 tracking-wide">{unit}</p>
        )}
        {showStatus && score != null && (
          <motion.p
            className="text-[9px] uppercase tracking-[0.18em] font-bold mt-1.5"
            style={{ color }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.0, duration: 0.4 }}
          >
            {status}
          </motion.p>
        )}
      </div>
    </div>
  )
}
