import { useEffect, useState } from 'react'

const COLORS = ['#F4A825', '#2D7A50', '#3B82F6', '#EC4899', '#8B5CF6', '#F59E0B']
const MESSAGES = ['🔥 Crushed it!', '⚡ Done!', '✅ Yes!', '🎯 Nailed it!', '💪 Built!', '🚀 Shipped!']

function ConfettiPiece({ color, x, delay }) {
  return (
    <div
      className="absolute w-2 h-2 rounded-sm confetti-piece pointer-events-none"
      style={{
        backgroundColor: color,
        left: x,
        top: '-8px',
        animationDelay: `${delay}ms`,
      }}
    />
  )
}

export function CelebrationBurst({ active, onDone }) {
  const [pieces] = useState(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      color: COLORS[i % COLORS.length],
      x: `${10 + (i * 7)}%`,
      delay: i * 40,
    }))
  )

  useEffect(() => {
    if (active) {
      const t = setTimeout(onDone, 1200)
      return () => clearTimeout(t)
    }
  }, [active, onDone])

  if (!active) return null

  return (
    <div className="fixed top-16 left-0 right-0 pointer-events-none z-50 flex justify-center">
      <div className="relative w-64">
        {pieces.map(p => <ConfettiPiece key={p.id} {...p} />)}
        <div className="pop-in mt-8 bg-white border-2 border-gold-400 rounded-xl px-5 py-2.5 shadow-lg text-center mx-auto w-fit">
          <p className="font-display font-bold text-navy-900 text-sm">
            {MESSAGES[Math.floor(Math.random() * MESSAGES.length)]}
          </p>
        </div>
      </div>
    </div>
  )
}
