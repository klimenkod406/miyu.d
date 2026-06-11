import { useState } from 'react'
import { Users } from 'lucide-react'

export interface VenueZone {
  id: string
  name: string
  shortName?: string
  color: string
  maxCapacity: number
  path: string
  /** Position to render the label (in viewBox coordinates) */
  labelX: number
  labelY: number
}

export interface VenuePlan {
  id: string
  name: string
  description: string
  totalCapacity: number
  zones: VenueZone[]
  viewBox: string
  /** SVG path of the stage (rendered above zones) */
  stagePath: string
  /** Approx center of the stage for label placement */
  stageLabel: { x: number; y: number }
}

// Minimalist monochrome palette: gray scale with a single accent for premium zones
const COLORS = {
  vipGold: '#E8C77A',     // muted gold accent (only for VIP/premium)
  premium: '#9CA3AF',     // light gray
  near: '#6B7280',        // mid gray
  standardA: '#4B5563',   // dark gray
  standardB: '#374151',   // darker gray
  far: '#2D3441',         // darkest gray
  farB: '#1F2632',
  warmAccent: '#A78BFA',  // subtle violet accent (used sparingly for fan/parterre)
  bar: '#52606D',
}

export const venuePlans: VenuePlan[] = [
  // ───────────────────────────── STADIUM ─────────────────────────────
  {
    id: 'stadium',
    name: 'Стадион',
    description: 'Большая открытая площадка с трибунами по периметру',
    totalCapacity: 50000,
    viewBox: '0 0 800 600',
    stagePath: 'M 280 60 Q 400 30 520 60 L 540 110 Q 400 95 260 110 Z',
    stageLabel: { x: 400, y: 88 },
    zones: [
      {
        id: 'vip',
        name: 'VIP зона',
        shortName: 'VIP',
        color: COLORS.vipGold,
        maxCapacity: 500,
        // Small rounded rectangle close to stage
        path: 'M 350 180 h 100 a 12 12 0 0 1 12 12 v 60 a 12 12 0 0 1 -12 12 h -100 a 12 12 0 0 1 -12 -12 v -60 a 12 12 0 0 1 12 -12 z',
        labelX: 400,
        labelY: 222,
      },
      {
        id: 'fan-zone',
        name: 'Фан-зона',
        shortName: 'FAN',
        color: COLORS.near,
        maxCapacity: 5000,
        // Curved trapezoid surrounding VIP
        path: 'M 280 280 Q 280 150 400 150 Q 520 150 520 280 L 520 360 Q 400 380 280 360 Z M 350 180 h 100 a 12 12 0 0 1 12 12 v 60 a 12 12 0 0 1 -12 12 h -100 a 12 12 0 0 1 -12 -12 v -60 a 12 12 0 0 1 12 -12 z',
        labelX: 400,
        labelY: 320,
      },
      {
        id: 'tribune-north',
        name: 'Трибуна Север',
        shortName: 'СЕВЕР',
        color: COLORS.premium,
        maxCapacity: 15000,
        // Curved tribune at top
        path: 'M 140 130 Q 400 70 660 130 L 640 170 Q 400 115 160 170 Z',
        labelX: 400,
        labelY: 145,
      },
      {
        id: 'tribune-south',
        name: 'Трибуна Юг',
        shortName: 'ЮГ',
        color: COLORS.standardA,
        maxCapacity: 15000,
        // Curved tribune at bottom
        path: 'M 140 470 Q 400 530 660 470 L 640 430 Q 400 485 160 430 Z',
        labelX: 400,
        labelY: 458,
      },
      {
        id: 'tribune-west',
        name: 'Трибуна Запад',
        shortName: 'ЗАПАД',
        color: COLORS.far,
        maxCapacity: 8000,
        // Curved side tribune (left)
        path: 'M 110 200 Q 60 300 110 400 L 160 380 Q 130 300 160 220 Z',
        labelX: 110,
        labelY: 300,
      },
      {
        id: 'tribune-east',
        name: 'Трибуна Восток',
        shortName: 'ВОСТОК',
        color: COLORS.farB,
        maxCapacity: 8000,
        // Curved side tribune (right)
        path: 'M 690 200 Q 740 300 690 400 L 640 380 Q 670 300 640 220 Z',
        labelX: 690,
        labelY: 300,
      },
    ],
  },

  // ───────────────────────────── ARENA ─────────────────────────────
  {
    id: 'arena',
    name: 'Арена',
    description: 'Закрытая арена с круговым расположением секторов',
    totalCapacity: 20000,
    viewBox: '0 0 600 600',
    stagePath: 'M 220 50 Q 300 20 380 50 L 395 95 Q 300 80 205 95 Z',
    stageLabel: { x: 300, y: 75 },
    zones: [
      {
        id: 'golden-circle',
        name: 'Золотой круг',
        shortName: 'GOLD',
        color: COLORS.vipGold,
        maxCapacity: 1000,
        // Inner circle near stage
        path: 'M 300 200 m -55 0 a 55 55 0 1 0 110 0 a 55 55 0 1 0 -110 0',
        labelX: 300,
        labelY: 205,
      },
      {
        id: 'parterre',
        name: 'Партер',
        shortName: 'PARTERRE',
        color: COLORS.near,
        maxCapacity: 3000,
        // Ring around golden circle
        path: 'M 300 200 m -110 0 a 110 110 0 1 0 220 0 a 110 110 0 1 0 -220 0 M 300 200 m -55 0 a 55 55 0 1 0 110 0 a 55 55 0 1 0 -110 0',
        labelX: 300,
        labelY: 320,
      },
      {
        id: 'sector-a',
        name: 'Сектор A',
        shortName: 'A',
        color: COLORS.premium,
        maxCapacity: 4000,
        // Top-right pie slice
        path: 'M 300 300 L 504 200 A 220 220 0 0 1 504 400 Z',
        labelX: 460,
        labelY: 300,
      },
      {
        id: 'sector-b',
        name: 'Сектор B',
        shortName: 'B',
        color: COLORS.standardA,
        maxCapacity: 4000,
        // Bottom pie slice
        path: 'M 300 300 L 504 400 A 220 220 0 0 1 96 400 Z',
        labelX: 300,
        labelY: 480,
      },
      {
        id: 'sector-c',
        name: 'Сектор C',
        shortName: 'C',
        color: COLORS.standardB,
        maxCapacity: 4000,
        // Top-left pie slice
        path: 'M 300 300 L 96 400 A 220 220 0 0 1 96 200 Z',
        labelX: 140,
        labelY: 300,
      },
      {
        id: 'sector-d',
        name: 'Сектор D',
        shortName: 'D',
        color: COLORS.far,
        maxCapacity: 4000,
        // Top pie slice (excluded near stage)
        path: 'M 300 300 L 96 200 A 220 220 0 0 1 504 200 Z M 300 200 m -110 0 a 110 110 0 1 0 220 0 a 110 110 0 1 0 -220 0',
        labelX: 300,
        labelY: 130,
      },
    ],
  },

  // ───────────────────────────── CLUB ─────────────────────────────
  {
    id: 'club',
    name: 'Клуб',
    description: 'Камерная площадка с танцполом и балконом',
    totalCapacity: 1500,
    viewBox: '0 0 400 300',
    stagePath: 'M 90 30 Q 200 15 310 30 L 320 65 Q 200 55 80 65 Z',
    stageLabel: { x: 200, y: 50 },
    zones: [
      {
        id: 'stage-front',
        name: 'У сцены',
        shortName: 'FRONT',
        color: COLORS.near,
        maxCapacity: 300,
        // Closest to stage
        path: 'M 70 90 h 260 a 8 8 0 0 1 8 8 v 32 a 8 8 0 0 1 -8 8 h -260 a 8 8 0 0 1 -8 -8 v -32 a 8 8 0 0 1 8 -8 z',
        labelX: 200,
        labelY: 116,
      },
      {
        id: 'dance-floor',
        name: 'Танцпол',
        shortName: 'DANCE',
        color: COLORS.standardA,
        maxCapacity: 800,
        path: 'M 70 150 h 260 a 8 8 0 0 1 8 8 v 50 a 8 8 0 0 1 -8 8 h -260 a 8 8 0 0 1 -8 -8 v -50 a 8 8 0 0 1 8 -8 z',
        labelX: 200,
        labelY: 184,
      },
      {
        id: 'bar-area',
        name: 'Барная зона',
        shortName: 'BAR',
        color: COLORS.bar,
        maxCapacity: 200,
        // Two thin columns on sides
        path: 'M 30 90 h 30 a 6 6 0 0 1 6 6 v 130 a 6 6 0 0 1 -6 6 h -30 a 6 6 0 0 1 -6 -6 v -130 a 6 6 0 0 1 6 -6 z M 340 90 h 30 a 6 6 0 0 1 6 6 v 130 a 6 6 0 0 1 -6 6 h -30 a 6 6 0 0 1 -6 -6 v -130 a 6 6 0 0 1 6 -6 z',
        labelX: 45,
        labelY: 160,
      },
      {
        id: 'balcony',
        name: 'Балкон',
        shortName: 'VIP',
        color: COLORS.vipGold,
        maxCapacity: 200,
        path: 'M 70 240 h 260 a 8 8 0 0 1 8 8 v 28 a 8 8 0 0 1 -8 8 h -260 a 8 8 0 0 1 -8 -8 v -28 a 8 8 0 0 1 8 -8 z',
        labelX: 200,
        labelY: 264,
      },
    ],
  },

  // ───────────────────────────── OPEN-AIR ─────────────────────────────
  {
    id: 'open-air',
    name: 'Открытая площадка',
    description: 'Летняя площадка под открытым небом',
    totalCapacity: 10000,
    viewBox: '0 0 700 500',
    stagePath: 'M 230 40 Q 350 15 470 40 L 485 90 Q 350 75 215 90 Z',
    stageLabel: { x: 350, y: 67 },
    zones: [
      {
        id: 'vip-lounge',
        name: 'VIP лаунж',
        shortName: 'VIP',
        color: COLORS.vipGold,
        maxCapacity: 500,
        // Closest layered rectangle to stage
        path: 'M 240 120 h 220 a 10 10 0 0 1 10 10 v 50 a 10 10 0 0 1 -10 10 h -220 a 10 10 0 0 1 -10 -10 v -50 a 10 10 0 0 1 10 -10 z',
        labelX: 350,
        labelY: 158,
      },
      {
        id: 'front-zone',
        name: 'Передняя зона',
        shortName: 'FRONT',
        color: COLORS.near,
        maxCapacity: 2500,
        path: 'M 180 200 h 340 a 10 10 0 0 1 10 10 v 70 a 10 10 0 0 1 -10 10 h -340 a 10 10 0 0 1 -10 -10 v -70 a 10 10 0 0 1 10 -10 z',
        labelX: 350,
        labelY: 250,
      },
      {
        id: 'general-admission',
        name: 'Общая зона',
        shortName: 'GENERAL',
        color: COLORS.standardA,
        maxCapacity: 5000,
        path: 'M 110 310 h 480 a 10 10 0 0 1 10 10 v 70 a 10 10 0 0 1 -10 10 h -480 a 10 10 0 0 1 -10 -10 v -70 a 10 10 0 0 1 10 -10 z',
        labelX: 350,
        labelY: 360,
      },
      {
        id: 'lawn',
        name: 'Газон',
        shortName: 'LAWN',
        color: COLORS.far,
        maxCapacity: 2000,
        path: 'M 60 420 h 580 a 10 10 0 0 1 10 10 v 50 a 10 10 0 0 1 -10 10 h -580 a 10 10 0 0 1 -10 -10 v -50 a 10 10 0 0 1 10 -10 z',
        labelX: 350,
        labelY: 458,
      },
    ],
  },
]

interface VenuePlanPreviewProps {
  plan: VenuePlan
  selectedZones?: string[]
  onZoneClick?: (zoneId: string) => void
}

export function VenuePlanPreview({ plan, selectedZones = [], onZoneClick }: VenuePlanPreviewProps) {
  const [hoveredZone, setHoveredZone] = useState<string | null>(null)
  const interactive = !!onZoneClick

  return (
    <div className="space-y-4">
      {/* SVG plan */}
      <div className="relative rounded-xl bg-white/[0.015] p-4 md:p-6 border border-white/[0.05] overflow-hidden">
        <svg viewBox={plan.viewBox} className="relative w-full h-auto">
          {/* Zones */}
          {plan.zones.map((zone) => {
            const isSelected = selectedZones.includes(zone.id)
            const isHovered = hoveredZone === zone.id
            const baseOpacity = isSelected ? 0.85 : isHovered ? 0.55 : 0.32
            return (
              <g key={zone.id}>
                <path
                  d={zone.path}
                  fillRule="evenodd"
                  fill={zone.color}
                  opacity={baseOpacity}
                  stroke={isSelected ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.1)'}
                  strokeWidth={isSelected ? 1.5 : 1}
                  className={interactive ? 'cursor-pointer transition-all duration-150' : 'transition-all duration-150'}
                  onClick={() => onZoneClick?.(zone.id)}
                  onMouseEnter={() => setHoveredZone(zone.id)}
                  onMouseLeave={() => setHoveredZone(null)}
                />
                <text
                  x={zone.labelX}
                  y={zone.labelY}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.85)"
                  fontSize="12"
                  fontWeight="500"
                  letterSpacing="1"
                  className="pointer-events-none select-none"
                >
                  {zone.shortName || zone.name}
                </text>
              </g>
            )
          })}

          {/* Stage */}
          <path
            d={plan.stagePath}
            fill="rgba(255,255,255,0.08)"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="1"
          />
          <text
            x={plan.stageLabel.x}
            y={plan.stageLabel.y}
            textAnchor="middle"
            fill="rgba(255,255,255,0.5)"
            fontSize="11"
            fontWeight="600"
            letterSpacing="3"
            className="select-none pointer-events-none"
          >
            СЦЕНА
          </text>
        </svg>

        {/* Capacity badge */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-[11px]">
          <Users className="w-3 h-3 text-white/40" />
          <span className="text-white/60">{plan.totalCapacity.toLocaleString()}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
        {plan.zones.map((zone) => {
          const isSelected = selectedZones.includes(zone.id)
          return (
            <button
              key={zone.id}
              type="button"
              onClick={() => onZoneClick?.(zone.id)}
              onMouseEnter={() => setHoveredZone(zone.id)}
              onMouseLeave={() => setHoveredZone(null)}
              disabled={!interactive}
              className={`flex items-center gap-2 p-2 rounded-lg border text-left transition ${
                isSelected
                  ? 'bg-white/[0.06] border-white/20'
                  : 'bg-transparent border-white/[0.05] hover:bg-white/[0.03] hover:border-white/10'
              } ${interactive ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <div
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: zone.color, opacity: 0.7 }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate text-white/80">{zone.name}</p>
                <p className="text-[10px] text-white/30">{zone.maxCapacity.toLocaleString()} мест</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
