import { motion } from 'framer-motion'

interface FilterPillsProps {
  name: string
  options: { id: string; label: string }[]
  selected: string | string[]
  onChange: (id: string) => void
  multi?: boolean
}

/**
 * Pill-shaped filter options with an animated sliding background indicator.
 * Supports single-select (default) and multi-select modes.
 */
export default function FilterPills({
  name,
  options,
  selected,
  onChange,
  multi = false,
}: FilterPillsProps) {
  const isSelected = (id: string) =>
    Array.isArray(selected) ? selected.includes(id) : selected === id

  return (
    <div className="inline-flex gap-1 bg-white/[0.02] rounded-lg p-1">
      {options.map((option) => {
        const active = isSelected(option.id)
        return (
          <button
            key={option.id}
            onClick={() => onChange(option.id)}
            className={`relative z-10 px-3 py-1.5 text-sm rounded-full transition ${
              active ? 'text-white' : 'text-white/50 hover:text-white'
            }`}
          >
            {active && (
              <motion.div
                layoutId={`pill-bg-${name}`}
                className="absolute inset-0 bg-purple-500 rounded-full"
              />
            )}
            <span className="relative z-10">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
