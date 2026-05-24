import { Component } from '@angular/core';

@Component({
  selector: 'app-privacy',
  standalone: true,
  template: `
    <div style="max-width: 800px; margin: 0 auto; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6;">
      <h1>Privacy Policy</h1>
      <p><strong>Last updated:</strong> May 2026</p>

      <h2>Information We Collect</h2>
      <p>When you use TradeAsk, we collect:</p>
      <ul>
        <li><strong>Email address</strong> — to send you answers to your questions</li>
        <li><strong>Questions you submit</strong> — including text and any attached photos/documents</li>
        <li><strong>Account information</strong> — if you create an account (name, email, profile photo from Google)</li>
      </ul>

      <h2>How We Use Your Information</h2>
      <ul>
        <li>To answer your construction and trade compliance questions</li>
        <li>To send you answers via email and push notifications</li>
        <li>To improve our answer quality through expert review</li>
      </ul>

      <h2>Third-Party Services</h2>
      <p>We use the following services to operate TradeAsk:</p>
      <ul>
        <li><strong>Anthropic (Claude AI)</strong> — processes your questions to generate answers. Your questions are sent to their API but are NOT used to train their models.</li>
        <li><strong>SendGrid</strong> — delivers email responses to you</li>
        <li><strong>Firebase</strong> — handles authentication (if you create an account)</li>
      </ul>

      <h2>Data Storage</h2>
      <p>Your data is stored on secure servers in the United States. Questions and answers are retained indefinitely to improve our knowledge base.</p>

      <h2>Your Rights</h2>
      <p>You may request deletion of your data at any time by contacting us at <strong>privacy&#64;tradeask.app</strong>.</p>

      <h2>Data Security</h2>
      <p>We use industry-standard encryption and security practices to protect your information.</p>

      <h2>Contact</h2>
      <p>For privacy questions, contact: <strong>privacy&#64;tradeask.app</strong></p>
    </div>
  `,
})
export class Privacy {}
