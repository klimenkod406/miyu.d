import { useRef, useState, useEffect, type ReactNode } from 'react'
import { motion } from 'framer-motion'

interface Tab {
  id: string
  label: string
  icon?: ReactNode
}

interface FilterTabsProps {
  tabs: Tab[]
  activeTab: string
  onChange: (id: string) => void
}

export default function FilterTabs({ tabs, activeTab, onChange }: FilterTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })

  useEffect(() => {
    const activeEl = tabRefs.current.get(activeTab)
    const container = containerRef.current
    if (activeEl && container) {
      const containerRect = container.getBoundingClientRect()
      const tabRect = activeEl.getBoundingClientRect()
      setIndicator({
        left: tabRect.left - containerRect.left,
        width: tabRect.width,
      })
    }
  }, [activeTab, tabs])

  return (
    <div
      ref={containerRef}
      className="flex gap-1 p-1 bg-white/[0.02] rounded-lg relative"
    >
      <motion.div
        layoutId="tab-indicator"
        data-testid="tab-indicator"
        className="absolute inset-0 glass-accent rounded-lg"
        style={{
          width: indicator.width,
          left: indicator.left,
          top: 4,
          bottom: 4,
        }}
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      />
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab
        return (
          <button
            key={tab.id}
            ref={(el) => {
              if (el) tabRefs.current.set(tab.id, el)
            }}
            onClick={() => onChange(tab.id)}
            className={`relative z-10 px-4 py-2 text-sm rounded-lg transition ${
              isActive ? 'text-white' : 'text-white/50 hover:text-white'
            }`}
          >
            {tab.icon && <span className="mr-1.5 inline-flex">{tab.icon}</span>}
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
