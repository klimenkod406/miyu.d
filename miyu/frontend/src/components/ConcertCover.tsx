import { useState, useEffect } from 'react'
import { Mic } from 'lucide-react'

interface Props {
  src?: string | null
  alt: string
  className?: string
  imgClassName?: string
  iconSize?: number
}

export default function ConcertCover({ src, alt, className = '', imgClassName = '', iconSize = 48 }: Props) {
  const [errored, setErrored] = useState(false)

  useEffect(() => {
    setErrored(false)
  }, [src])

  if (!src || errored) {
    return (
      <div className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-500/30 to-pink-500/30 ${className}`}>
        <Mic className="text-white/30" style={{ width: iconSize, height: iconSize }} />
      </div>
    )
  }

  return (
    <img loading="lazy"
      src={src}
      alt={alt}
      onError={() => setErrored(true)}
      className={`absolute inset-0 w-full h-full object-cover ${imgClassName}`}
    />
  )
}
