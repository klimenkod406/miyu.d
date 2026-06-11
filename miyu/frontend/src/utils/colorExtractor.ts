export async function extractColorsFromImage(imageUrl: string): Promise<string[]> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'Anonymous'

    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        resolve(['#8B5CF6', '#EC4899', '#3B82F6'])
        return
      }

      // Resize for performance
      const size = 100
      canvas.width = size
      canvas.height = size

      ctx.drawImage(img, 0, 0, size, size)

      try {
        const imageData = ctx.getImageData(0, 0, size, size)
        const pixels = imageData.data

        // Collect color samples
        const colors: { r: number; g: number; b: number; count: number }[] = []
        const colorMap = new Map<string, { r: number; g: number; b: number; count: number }>()

        for (let i = 0; i < pixels.length; i += 4 * 10) { // Sample every 10th pixel
          const r = pixels[i]
          const g = pixels[i + 1]
          const b = pixels[i + 2]
          const a = pixels[i + 3]

          // Skip transparent and very dark/light pixels
          if (a < 128 || (r + g + b) < 50 || (r + g + b) > 700) continue

          // Quantize colors to reduce variations
          const qr = Math.round(r / 32) * 32
          const qg = Math.round(g / 32) * 32
          const qb = Math.round(b / 32) * 32

          const key = `${qr},${qg},${qb}`

          if (colorMap.has(key)) {
            colorMap.get(key)!.count++
          } else {
            colorMap.set(key, { r: qr, g: qg, b: qb, count: 1 })
          }
        }

        // Sort by frequency
        const sortedColors = Array.from(colorMap.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)

        if (sortedColors.length === 0) {
          resolve(['#8B5CF6', '#EC4899', '#3B82F6'])
          return
        }

        // Pick 3 diverse colors
        const selectedColors: string[] = []

        // Add most dominant color
        selectedColors.push(rgbToHex(sortedColors[0].r, sortedColors[0].g, sortedColors[0].b))

        // Find colors that are different enough
        for (let i = 1; i < sortedColors.length && selectedColors.length < 3; i++) {
          const color = sortedColors[i]
          const isDifferent = selectedColors.every(existing => {
            const [er, eg, eb] = hexToRgb(existing)
            const distance = Math.sqrt(
              Math.pow(color.r - er, 2) +
              Math.pow(color.g - eg, 2) +
              Math.pow(color.b - eb, 2)
            )
            return distance > 100 // Minimum color distance
          })

          if (isDifferent) {
            selectedColors.push(rgbToHex(color.r, color.g, color.b))
          }
        }

        // Fill with variations if needed
        while (selectedColors.length < 3) {
          const base = sortedColors[0]
          const variation = adjustBrightness(base.r, base.g, base.b, selectedColors.length === 1 ? 1.3 : 0.7)
          selectedColors.push(variation)
        }

        resolve(selectedColors)
      } catch (error) {
        console.error('Error extracting colors:', error)
        resolve(['#8B5CF6', '#EC4899', '#3B82F6'])
      }
    }

    img.onerror = () => {
      resolve(['#8B5CF6', '#EC4899', '#3B82F6'])
    }

    img.src = imageUrl
  })
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }).join('')
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 0, 0]
}

function adjustBrightness(r: number, g: number, b: number, factor: number): string {
  const nr = Math.min(255, Math.max(0, Math.round(r * factor)))
  const ng = Math.min(255, Math.max(0, Math.round(g * factor)))
  const nb = Math.min(255, Math.max(0, Math.round(b * factor)))
  return rgbToHex(nr, ng, nb)
}
