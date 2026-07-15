import sgMail from '@sendgrid/mail';
import { config } from '../config/env';

const LOGO_URL = 'https://tradeask.app/assets/logo-email.png';

function emailWrapper(content: string): string {
  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
  <!-- Header with logo -->
  <div style="background: #0c4a6e; padding: 24px 32px; border-radius: 8px 8px 0 0;">
    <table cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="vertical-align: middle;">
        <div style="width: 36px; height: 36px; background: #ffffff; border-radius: 8px; display: inline-block; text-align: center; line-height: 36px;">
          <span style="font-size: 18px; font-weight: bold; color: #0c4a6e;">T</span>
        </div>
      </td>
      <td style="vertical-align: middle; padding-left: 12px;">
        <span style="color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">ExpertAsk</span>
      </td>
    </tr></table>
  </div>

  <!-- Body -->
  <div style="padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    ${content}
  </div>

  <!-- Footer -->
  <div style="padding: 20px 32px; text-align: center;">
    <p style="font-size: 12px; color: #9ca3af; margin: 0;">
      ExpertAsk — AI answers verified by human experts<br>
      <a href="https://tradeask.app" style="color: #0284c7; text-decoration: none;">tradeask.app</a>
    </p>
  </div>
</div>`;
}

export async function sendAnswerEmail(
  toEmail: string,
  questionText: string,
  category: string,
  finalAnswer: string,
  chatLink?: string,
  wasCorrected?: boolean
): Promise<boolean> {
  if (!config.sendgrid.apiKey) {
    console.warn('SendGrid API key not configured — skipping email');
    return false;
  }

  sgMail.setApiKey(config.sendgrid.apiKey);

  const reviewMessage = wasCorrected
    ? 'An industry expert has reviewed and <strong>corrected</strong> the AI-generated response to your question. The updated answer is below.'
    : 'An industry expert has reviewed and <strong>approved</strong> the AI-generated answer to your question.';

  const content = `
    <h2 style="color: #111827; font-size: 20px; margin: 0 0 8px 0;">Your answer is ready</h2>
    <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px 0;">${reviewMessage}</p>

    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
      <p style="font-size: 12px; font-weight: 600; color: #0284c7; text-transform: uppercase; margin: 0 0 6px 0;">${escapeHtml(category)}</p>
      <p style="color: #111827; font-size: 14px; margin: 0;">${escapeHtml(questionText)}</p>
    </div>

    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
        <span style="font-size: 11px; font-weight: 600; color: #166534; background: #dcfce7; padding: 2px 8px; border-radius: 10px;">✓ Expert ${wasCorrected ? 'corrected' : 'verified'}</span>
      </div>
      <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0;">${escapeHtml(finalAnswer).replace(/\n/g, '<br>')}</p>
    </div>

    ${chatLink ? `
    <div style="text-align: center; margin: 24px 0;">
      <a href="${chatLink}" style="background: #0c4a6e; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">View in chat →</a>
    </div>
    <p style="text-align: center; font-size: 13px; color: #6b7280;">Continue the conversation or ask a follow-up question</p>
    ` : `
    <div style="text-align: center; margin: 24px 0;">
      <a href="https://tradeask.app/ask" style="background: #0c4a6e; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">Ask another question →</a>
    </div>
    `}
  `;

  const subject = wasCorrected
    ? 'Your ExpertAsk question — expert-corrected answer ready'
    : 'Your ExpertAsk question — expert-verified answer ready';

  const msg = {
    to: toEmail,
    from: { email: config.sendgrid.fromEmail, name: config.sendgrid.fromName },
    subject,
    html: emailWrapper(content),
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

  const content = `
    <h2 style="color: #111827; font-size: 20px; margin: 0 0 8px 0;">Welcome aboard, ${escapeHtml(name)}!</h2>
    <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px 0;">Your expert account has been approved. You can now help tradespeople get accurate, verified answers.</p>

    <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <p style="color: #0c4a6e; font-size: 14px; margin: 0 0 8px 0; font-weight: 600;">How it works:</p>
      <p style="color: #374151; font-size: 14px; margin: 0; line-height: 1.6;">
        Questions come in from tradespeople. AI generates a first draft. You review, edit if needed, and approve. The verified answer gets sent to the person who asked.
      </p>
    </div>

    <div style="text-align: center; margin: 24px 0;">
      <a href="https://tradeask.app/admin" style="background: #0c4a6e; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">Start answering questions →</a>
    </div>
  `;

  const msg = {
    to: toEmail,
    from: { email: config.sendgrid.fromEmail, name: config.sendgrid.fromName },
    subject: 'Welcome to ExpertAsk — your expert account is live',
    html: emailWrapper(content),
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
