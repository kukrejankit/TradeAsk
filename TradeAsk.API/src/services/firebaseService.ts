import * as admin from 'firebase-admin';

let initialized = false;

function getApp() {
  if (!initialized) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(serviceAccount)),
      });
    } else {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
    }
    initialized = true;
  }
  return admin;
}

export async function verifyFirebaseToken(idToken: string): Promise<admin.auth.DecodedIdToken | null> {
  try {
    const decoded = await getApp().auth().verifyIdToken(idToken);
    return decoded;
  } catch (error) {
    console.error('Firebase token verification failed:', error);
    return null;
  }
}
