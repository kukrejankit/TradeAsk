import { queryOne } from '../models/database';

export async function sendPushNotification(
  userEmail: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
  try {
    const user = await queryOne<any>('SELECT push_token, push_platform FROM users WHERE email = ?', [userEmail]);
    if (!user || !user.push_token) return false;

    const message = {
      to: user.push_token,
      sound: 'default',
      title,
      body,
      data: data || {},
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      console.error('Push notification failed:', await response.text());
      return false;
    }

    console.log(`Push sent to ${userEmail}: ${title}`);
    return true;
  } catch (error) {
    console.error('Push notification error:', error);
    return false;
  }
}
