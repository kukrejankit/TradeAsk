import sgMail from '@sendgrid/mail';
import { config } from '../config/env';

export async function sendAnswerEmail(
  toEmail: string,
  questionText: string,
  category: string,
  finalAnswer: string,
  chatLink?: string
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

  ${chatLink ? `<div style="margin: 20px 0;">
    <a href="${chatLink}" style="background: #0284c7; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View in chat &rarr;</a>
  </div>
  <p style="font-size: 14px; color: #666;">You can ask follow-up questions in your chat session.</p>` : `<p>Have another question? Visit <a href="https://tradeask.app">https://tradeask.app</a></p>`}

  <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
  <p style="font-size: 12px; color: #999;">
    TradeAsk | AI-powered compliance answers for field professionals<br>
    You received this because you submitted a question at tradeask.app
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

export async function sendExpertApprovalEmail(toEmail: string, name: string): Promise<boolean> {
  if (!config.sendgrid.apiKey) {
    console.warn('SendGrid API key not configured — skipping email');
    return false;
  }

  sgMail.setApiKey(config.sendgrid.apiKey);

  const htmlBody = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #1a1a1a;">Welcome to TradeAsk, ${escapeHtml(name)}!</h2>
  <p>Great news — your expert account has been approved.</p>
  <p>You can now log in and start answering questions in your area of expertise. Your knowledge helps tradespeople get accurate, verified answers.</p>

  <div style="margin: 24px 0;">
    <a href="https://tradeask.app/admin" style="background: #0284c7; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Start answering questions →</a>
  </div>

  <p style="font-size: 14px; color: #666;">
    Questions are reviewed by AI first, then sent to experts like you for verification. You'll see the AI draft and can approve, edit, or replace it.
  </p>

  <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
  <p style="font-size: 12px; color: #999;">
    TradeAsk | AI-powered compliance answers for field professionals
  </p>
</div>`;

  const msg = {
    to: toEmail,
    from: { email: config.sendgrid.fromEmail, name: config.sendgrid.fromName },
    subject: 'Your TradeAsk expert account is approved ✓',
    html: htmlBody,
  };

  try {
    await sgMail.send(msg);
    console.log(`Approval email sent to ${toEmail}`);
    return true;
  } catch (error) {
    console.error('SendGrid approval email failed:', error);
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
