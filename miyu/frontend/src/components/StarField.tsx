import { useEffect, useState } from 'react'

interface Star {
  id: number
  angle: number
  distance: number
  speed: number
  size: number
  opacity: number
  offsetAngle: number
  twinkle: boolean
  twinkleSpeed: number
}

interface Meteor {
  id: number
  delay: number
}

function random(min: number, max: number) {
  return Math.random() * (max - min) + min
}

function generateStar(id: number): Star {
  const shouldTwinkle = Math.random() < 0.2
  return {
    id,
    angle: random(0, 360),
    distance: random(20, 200),
    speed: 0.0252, // 0.028 * 0.9 = замедление на 10%
    size: Math.random() < 0.3 ? 2.4 : Math.random() < 0.6 ? 3.2 : 4, // уменьшение на 20%
    opacity: random(0.85, 1),
    offsetAngle: random(-20, 20),
    twinkle: shouldTwinkle,
    twinkleSpeed: random(0.002, 0.005),
  }
}

function generateStars(count: number): Star[] {
  return Array.from({ length: count }, (_, i) => generateStar(i))
}

function generateMeteors(count: number, intervalMs: number): Meteor[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    delay: i * intervalMs,
  }))
}

export default function StarField({ className = '' }: { className?: string }) {
  const [stars, setStars] = useState<Star[]>(() => generateStars(300))
  const [, setFrame] = useState(0)
  const [meteors, setMeteors] = useState<Meteor[]>([])
  const [meteorKey, setMeteorKey] = useState(0)

  const centerX = 140
  const centerY = 140

  useEffect(() => {
    const meteorsList = generateMeteors(3, 4000)
    setMeteors(meteorsList)

    const interval = setInterval(() => {
      setMeteorKey(k => k + 1)
    }, 4000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const animate = setInterval(() => {
      setStars(prev => prev.map(star => {
        let newAngle = star.angle - star.speed
        if (newAngle < 0) newAngle = 360 + newAngle
        return { ...star, angle: newAngle }
      }))
      setFrame(f => f + 1)
    }, 16)

    return () => clearInterval(animate)
  }, [])

  return (
    <div className={`starfield fixed inset-0 pointer-events-none z-0 ${className}`}>
      {stars.map((star) => {
        const orbitAngle = star.offsetAngle * (Math.PI / 180)
        const orbitRad = (star.angle * Math.PI) / 180
        
        let x = centerX + star.distance * Math.cos(orbitRad + orbitAngle)
        let y = centerY + star.distance * Math.sin(orbitRad + orbitAngle)
        
        if (x < -2) x = 102
        if (x > 102) x = -2
        if (y < -2) y = 102
        if (y > 102) y = -2
        
        const visible = x >= -2 && x <= 102 && y >= -2 && y <= 102
        const twinkle = visible 
          ? star.twinkle 
            ? star.opacity * (0.9 + 0.1 * Math.sin(Date.now() * star.twinkleSpeed + star.id))
            : star.opacity
          : 0
        
        return (
          <div
            key={star.id}
            className="star"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: twinkle,
            }}
          />
        )
      })}

      {meteors.map((meteor) => (
        <div
          key={`${meteor.id}-${meteorKey}`}
          className="meteor"
          style={{
            top: '110%',
            left: '90%',
            width: '100px',
            height: '2px',
            background: 'linear-gradient(to bottom left, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 100%)',
            animation: 'meteorFall 1.5s ease-out forwards',
            animationDelay: `${meteor.delay}ms`,
          }}
        />
      ))}

      <style>{`
        .starfield {
          background: #050505;
        }
        .star {
          position: absolute;
          background: #fff;
          border-radius: 50%;
        }
        .meteor {
          position: absolute;
          transform: rotate(30deg);
          transform-origin: left center;
        }
        @keyframes meteorFall {
          0% { transform: translate(0, 0) rotate(30deg); opacity: 0; }
          10% { opacity: 1; }
          100% { transform: translate(-100vw, 100vh) rotate(30deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}