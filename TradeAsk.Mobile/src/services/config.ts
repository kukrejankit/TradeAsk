const DEV_API = 'http://localhost:3000/api';
const PROD_API = 'https://api.tradeask.app/api';

export const API_URL = __DEV__ ? DEV_API : PROD_API;

export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAOqUAyftbEq216zv3g0z_eZEUIwH6mrvA',
  authDomain: 'tradeask-de59b.firebaseapp.com',
  projectId: 'tradeask-de59b',
  storageBucket: 'tradeask-de59b.firebasestorage.app',
  messagingSenderId: '263030989909',
  appId: '1:263030989909:web:259905909356987b9760dc',
};

export const GOOGLE_WEB_CLIENT_ID = '263030989909-r0ctj8b5300p70vit676pgjh97caqj13.apps.googleusercontent.com';




