import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'localhost',
  port: parseInt(process.env.MAIL_PORT || '1025', 10),
  secure: false,
  ...(process.env.MAIL_USER ? {
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    }
  } : {}),
});
const delays = [1000, 5000, 30000];
const MAX_RETRIES = 3;

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[EMAIL] Attempt ${attempt}/${MAX_RETRIES} — To: ${to}, Subject: "${subject}"`);
      const info = await transporter.sendMail({
        from: process.env.MAIL_FROM || 'noreply@miyu.local',
        to,
        subject,
        html,
      });
      console.log(`[EMAIL] Sent — MessageId: ${info.messageId}`);
      return;
    } catch (err: any) {
      console.error(`[EMAIL] Attempt ${attempt} failed: ${err.message}`);
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, delays[attempt - 1]));
      }
    }
  }
  console.error(`[EMAIL] All ${MAX_RETRIES} attempts failed for "${to}"`);
}

export { transporter };
