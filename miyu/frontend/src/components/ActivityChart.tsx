import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const DATA = Array.from({ length: 30 }, (_, i) => {
  const day = i + 1
  const basePlays = 50000 + Math.random() * 150000 + Math.sin(i / 3) * 30000
  const basePremium = 5000 + Math.random() * 10000 + Math.cos(i / 4) * 5000
  const baseRevenue = 1000 + Math.random() * 3000 + Math.sin(i / 2) * 1000
  
  return {
    day: day,
    date: `0${day}.04`,
    plays: Math.round(basePlays),
    premium: Math.round(basePremium),
    revenue: Math.round(baseRevenue),
  }
})

function formatValue(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`
  return value.toString()
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload) return null

  return (
    <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-3 shadow-2xl">
      <p className="text-white/60 text-xs mb-2">{label} апреля</p>
      {payload.map((entry, idx) => (
        <div key={idx} className="flex items-center gap-2 text-sm">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-white/40">
            {entry.name === 'plays' ? 'Прослушивания' : 
             entry.name === 'premium' ? 'Премиум' : 'Доходы'}
          </span>
          <span className="text-white font-medium ml-auto">{formatValue(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function ActivityChart() {
  const totalPlays = useMemo(() => DATA.reduce((sum, d) => sum + d.plays, 0), [])
  const totalPremium = useMemo(() => DATA.reduce((sum, d) => sum + d.premium, 0), [])
  const totalRevenue = useMemo(() => DATA.reduce((sum, d) => sum + d.revenue, 0), [])

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Activity</h2>
          <p className="text-white/40 text-sm">Активность за последние 30 дней</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="text-right">
            <p className="text-white/40">Прослушивания</p>
            <p className="text-white font-semibold">{formatValue(totalPlays)}</p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-right">
            <p className="text-white/40">Премиум</p>
            <p className="text-yellow-400 font-semibold">{formatValue(totalPremium)}</p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-right">
            <p className="text-white/40">Доходы</p>
            <p className="text-green-400 font-semibold">{formatValue(totalRevenue)}</p>
          </div>
        </div>
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={DATA} barSize={8}>
            <XAxis 
              dataKey="date" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#ffffff30', fontSize: 10 }}
              interval={5}
            />
            <YAxis 
              hide 
              domain={[0, 'dataMax']}
              tickFormatter={formatValue}
            />
            <Tooltip 
              content={<CustomTooltip />}
              cursor={{ fill: '#ffffff08' }}
            />
            <Bar dataKey="revenue" stackId="stack" radius={[0, 0, 0, 0]} fill="#22c55e" />
            <Bar dataKey="premium" stackId="stack" radius={[0, 0, 0, 0]} fill="#facc15" />
            <Bar dataKey="plays" stackId="stack" radius={[4, 4, 0, 0]} fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-white/60 text-sm">Прослушивания</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <span className="text-white/60 text-sm">Премиум</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-white/60 text-sm">Доходы</span>
        </div>
      </div>
    </div>
  )
}