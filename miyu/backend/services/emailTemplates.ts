/**
 * HTML email templates для Miyu.
 * Только inline CSS (Gmail-совместимость), никаких внешних ресурсов.
 * Все тексты на русском языке.
 */

/**
 * Письмо для сброса пароля.
 * @param resetLink — ссылка на страницу сброса пароля
 */
export function passwordResetEmail(resetLink: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; background: #111; color: #eee; padding: 40px;">
  <div style="max-width: 480px; margin: 0 auto; background: #1a1a2e; border-radius: 12px; padding: 32px;">
    <h1 style="color: #e94560; font-size: 24px; margin: 0 0 16px;">Сброс пароля</h1>
    <p style="font-size: 16px; line-height: 1.6; color: #ccc;">Вы запросили сброс пароля для вашего аккаунта Miyu.</p>
    <p style="text-align: center; margin: 24px 0;">
      <a href="${resetLink}" style="display: inline-block; background: #e94560; color: #fff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: bold;">Сбросить пароль</a>
    </p>
    <p style="font-size: 13px; color: #888;">Ссылка действительна в течение <strong>1 часа</strong>.</p>
    <p style="font-size: 13px; color: #666;">Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.</p>
    <hr style="border: none; border-top: 1px solid #333; margin: 24px 0;">
    <p style="font-size: 12px; color: #555;">Miyu — стриминговый сервис</p>
  </div>
</body>
</html>`;
}

/**
 * Письмо с электронным билетом на концерт.
 * @param ticket — объект билета (id, ticket_type_name, и т.д.)
 * @param concert — объект концерта (title, event_date, event_time, venue, city)
 * @param qrDataUrl — data-url изображения QR-кода
 */
export function ticketEmail(ticket: any, concert: any, qrDataUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; background: #111; color: #eee; padding: 40px;">
  <div style="max-width: 480px; margin: 0 auto; background: #1a1a2e; border-radius: 12px; padding: 32px;">
    <h1 style="color: #e94560; font-size: 24px; margin: 0 0 8px;">${concert.title || 'Концерт'}</h1>
    <p style="font-size: 14px; color: #ccc; margin: 0 0 24px;">Ваш электронный билет</p>

    <div style="background: #16213e; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
      <p style="margin: 4px 0; font-size: 14px; color: #aaa;">📅 Дата и время</p>
      <p style="margin: 0 0 12px; font-size: 16px; color: #fff;"><strong>${concert.event_date || ''} ${concert.event_time || ''}</strong></p>
      <p style="margin: 4px 0; font-size: 14px; color: #aaa;">📍 Место</p>
      <p style="margin: 0 0 12px; font-size: 16px; color: #fff;"><strong>${concert.venue || ''}, ${concert.city || ''}</strong></p>
      <p style="margin: 4px 0; font-size: 14px; color: #aaa;">🎫 Тип билета</p>
      <p style="margin: 0 0 12px; font-size: 16px; color: #fff;"><strong>${ticket.ticket_type_name || 'Стандарт'}</strong></p>
      <p style="margin: 4px 0; font-size: 14px; color: #aaa;">🆔 Номер билета</p>
      <p style="margin: 0; font-size: 16px; color: #fff;"><strong>#${ticket.id}</strong></p>
    </div>

    <div style="text-align: center; background: #fff; border-radius: 8px; padding: 16px;">
      <img src="${qrDataUrl}" alt="QR-код билета" style="width: 200px; height: 200px;">
      <p style="font-size: 12px; color: #333; margin: 8px 0 0;">Предъявите этот QR-код на входе</p>
    </div>

    <hr style="border: none; border-top: 1px solid #333; margin: 24px 0;">
    <p style="font-size: 12px; color: #666;">Билет действителен при предъявлении QR-кода. Не передавайте билет третьим лицам.</p>
    <p style="font-size: 12px; color: #555;">Miyu — стриминговый сервис</p>
  </div>
</body>
</html>`;
}
