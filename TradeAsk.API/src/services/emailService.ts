import sgMail from '@sendgrid/mail';
import { config } from '../config/env';

export async function sendAnswerEmail(
  toEmail: string,
  questionText: string,
  category: string,
  finalAnswer: string
): Promise<boolean> {
  if (!config.sendgrid.apiKey) {
    console.warn('SendGrid API key not configured — skipping email');
    return false;
  }

  sgMail.setApiKey(config.sendgrid.apiKey);

  const htmlBody = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #1a1a1a;">Your TradeAsk question — answered ✓</h2>
  <p>Hi,</p>
  <p>Here's the answer to your construction/trade question:</p>

  <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <p style="font-weight: bold; color: #555;">YOUR QUESTION:</p>
    <p>${escapeHtml(questionText)}</p>
    <p style="font-weight: bold; color: #555; margin-top: 16px;">CATEGORY: ${escapeHtml(category)}</p>
  </div>

  <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin: 20px 0; background: #f9f9f9;">
    <p style="font-weight: bold; color: #555;">ANSWER:</p>
    <div>${escapeHtml(finalAnswer).replace(/\n/g, '<br>')}</div>
  </div>

  <p style="font-size: 14px; color: #666;">
    This answer was reviewed by a construction industry professional before being sent to you.
  </p>
  <p>Have another question? Visit <a href="https://tradeask.io">https://tradeask.io</a></p>

  <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
  <p style="font-size: 12px; color: #999;">
    TradeAsk | AI-powered compliance answers for field professionals<br>
    You received this because you submitted a question at tradeask.io
  </p>
</div>`;

  const msg = {
    to: toEmail,
    from: { email: config.sendgrid.fromEmail, name: config.sendgrid.fromName },
    subject: 'Your TradeAsk question — answered ✓',
    html: htmlBody,
  };

  try {
    await sgMail.send(msg);
    console.log(`Email sent to ${toEmail}`);
    return true;
  } catch (error) {
    console.error('SendGrid email failed:', error);
    return false;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
