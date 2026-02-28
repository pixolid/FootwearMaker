import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

// Support both VITE_ prefix (Vite standard) and NEXT_PUBLIC_ prefix
// (copied from Pixogen .env.local). VITE_ takes priority.
const env = import.meta.env

const firebaseConfig = {
  apiKey:            env.VITE_FIREBASE_API_KEY            ?? env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        env.VITE_FIREBASE_AUTH_DOMAIN        ?? env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         env.VITE_FIREBASE_PROJECT_ID         ?? env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     env.VITE_FIREBASE_STORAGE_BUCKET     ?? env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             env.VITE_FIREBASE_APP_ID             ?? env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
// Standard Firestore — no long-polling/persistentLocalCache (avoids CORS errors in dev)
export const db = getFirestore(app)
export const storage = getStorage(app)
