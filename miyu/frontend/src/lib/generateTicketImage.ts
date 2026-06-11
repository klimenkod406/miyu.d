/**
 * Генератор изображения билета через Canvas API
 * Создаёт мобильный формат билета с QR-кодом и данными концерта
 */

interface TicketData {
  ticket_id: number
  concert_title: string
  artist_name: string
  event_date: string
  event_time: string
  venue: string
  address: string
  city: string
  country: string
  ticket_type_name: string
  price: number
  seat_row?: string
  seat_number?: string
  qr_code: string
}

/**
 * Загружает изображение из URL или base64
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    // crossOrigin только для внешних URL, не для data:
    if (!src.startsWith('data:')) {
      img.crossOrigin = 'anonymous'
    }
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = src
  })
}

/**
 * Рисует скруглённый прямоугольник
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

/**
 * Переносит текст по строкам если он не помещается в maxWidth
 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = words[0] || ''

  for (let i = 1; i < words.length; i++) {
    const word = words[i]
    const testLine = currentLine + ' ' + word
    const testWidth = ctx.measureText(testLine).width

    if (testWidth < maxWidth) {
      currentLine = testLine
    } else {
      lines.push(currentLine)
      currentLine = word
    }
  }

  lines.push(currentLine)
  return lines
}

/**
 * Генерирует изображение билета через Canvas API
 * Возвращает canvas элемент для дальнейшего скачивания через toBlob
 */
export async function generateTicketImage(ticket: TicketData): Promise<HTMLCanvasElement> {
  // Мобильный формат с увеличенным разрешением для чёткости
  const scale = 2
  const width = 375
  const height = 720

  const canvas = document.createElement('canvas')
  canvas.width = width * scale
  canvas.height = height * scale

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas context not available')

  // Масштабируем для Retina
  ctx.scale(scale, scale)

  // === ФОН С ГРАДИЕНТОМ ===
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, '#1e1b4b')
  gradient.addColorStop(0.5, '#581c87')
  gradient.addColorStop(1, '#831843')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  // === ДЕКОРАТИВНЫЕ ЭЛЕМЕНТЫ ===
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)'
  ctx.beginPath()
  ctx.arc(50, 100, 120, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(width - 80, height - 150, 150, 0, Math.PI * 2)
  ctx.fill()

  // === ЛОГОТИП MIYU ===
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.font = 'bold 32px system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Miyu', width / 2, 55)

  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
  ctx.font = '13px system-ui, -apple-system, sans-serif'
  ctx.fillText('БИЛЕТ НА КОНЦЕРТ', width / 2, 78)

  // === РАЗДЕЛИТЕЛЬНАЯ ЛИНИЯ ===
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(24, 98)
  ctx.lineTo(width - 24, 98)
  ctx.stroke()

  // === НАЗВАНИЕ КОНЦЕРТА ===
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 22px system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'center'

  const maxWidth = width - 60
  const titleLines = wrapText(ctx, ticket.concert_title, maxWidth)
  const titleY = 130
  titleLines.forEach((line, index) => {
    ctx.fillText(line, width / 2, titleY + index * 28)
  })

  // === АРТИСТ ===
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
  ctx.font = '16px system-ui, -apple-system, sans-serif'
  const artistY = titleY + titleLines.length * 28 + 8
  ctx.fillText(ticket.artist_name, width / 2, artistY)

  // === QR КОД ===
  let qrBottomY = artistY + 30
  try {
    const qrImage = await loadImage(ticket.qr_code)
    const qrSize = 170
    const qrX = (width - qrSize) / 2
    const qrY = qrBottomY

    // Белый фон для QR
    ctx.fillStyle = '#ffffff'
    roundRect(ctx, qrX - 12, qrY - 12, qrSize + 24, qrSize + 24, 14)
    ctx.fill()

    // QR код
    ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize)
    qrBottomY = qrY + qrSize + 12
  } catch (error) {
    console.error('Failed to load QR code:', error)
    // Placeholder если QR не загрузился
    const qrSize = 170
    const qrX = (width - qrSize) / 2
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
    roundRect(ctx, qrX, qrBottomY, qrSize, qrSize, 14)
    ctx.fill()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.font = '13px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('QR-код', width / 2, qrBottomY + qrSize / 2 + 5)
    qrBottomY = qrBottomY + qrSize + 12
  }

  // === РАЗДЕЛИТЕЛЬ — зубчатая линия (стилизация билета) ===
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(24, qrBottomY)
  ctx.lineTo(width - 24, qrBottomY)
  ctx.stroke()
  ctx.setLineDash([])

  // === ИНФОРМАЦИЯ О КОНЦЕРТЕ ===
  const infoY = qrBottomY + 16
  ctx.textAlign = 'left'

  // Дата и время
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)'
  ctx.font = '11px system-ui, -apple-system, sans-serif'
  ctx.fillText('ДАТА И ВРЕМЯ', 28, infoY)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 15px system-ui, -apple-system, sans-serif'
  ctx.fillText(`${ticket.event_date}${ticket.event_time ? ', ' + ticket.event_time : ''}`, 28, infoY + 18)

  // Место проведения
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)'
  ctx.font = '11px system-ui, -apple-system, sans-serif'
  ctx.fillText('МЕСТО ПРОВЕДЕНИЯ', 28, infoY + 44)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 15px system-ui, -apple-system, sans-serif'
  ctx.fillText(ticket.venue, 28, infoY + 62)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
  ctx.font = '13px system-ui, -apple-system, sans-serif'
  ctx.fillText(ticket.address, 28, infoY + 80)
  ctx.fillText(`${ticket.city}, ${ticket.country}`, 28, infoY + 97)

  // === ДЕТАЛИ БИЛЕТА (два столбца) ===
  const detailsY = infoY + 123

  // Тип билета (слева)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)'
  ctx.font = '11px system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('ТИП БИЛЕТА', 28, detailsY)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 14px system-ui, -apple-system, sans-serif'
  ctx.fillText(ticket.ticket_type_name, 28, detailsY + 17)

  // Цена (справа)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)'
  ctx.font = '11px system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('ЦЕНА', width - 28, detailsY)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 14px system-ui, -apple-system, sans-serif'
  ctx.fillText(`${ticket.price.toLocaleString('ru-RU')} ₽`, width - 28, detailsY + 17)

  // Место (если есть)
  if (ticket.seat_row || ticket.seat_number) {
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)'
    ctx.font = '11px system-ui, -apple-system, sans-serif'
    ctx.fillText('МЕСТО', 28, detailsY + 43)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 14px system-ui, -apple-system, sans-serif'
    const seatText = [
      ticket.seat_row ? `Ряд ${ticket.seat_row}` : '',
      ticket.seat_number ? `Место ${ticket.seat_number}` : ''
    ].filter(Boolean).join(', ')
    ctx.fillText(seatText, 28, detailsY + 60)
  }

  // === ID БИЛЕТА ===
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
  ctx.font = '11px system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(`Билет №${ticket.ticket_id}`, width / 2, height - 20)
  // Возвращаем canvas — скачивание через toBlob надёжнее
  return canvas
}
