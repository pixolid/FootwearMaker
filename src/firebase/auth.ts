import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
  type NextOrObserver,
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from './config'

const googleProvider = new GoogleAuthProvider()

export const doSignInWithGoogle = async () => {
  const result = await signInWithPopup(auth, googleProvider)
  const user = result.user

  // Check if user exists in Firestore, if not initialize
  const userDoc = await getDoc(doc(db, 'users', user.uid))
  if (!userDoc.exists()) {
    await setDoc(doc(db, 'users', user.uid), {
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      plan: 'basic',
      credits: 100,
      createdAt: new Date().toISOString(),
      source: 'footwearmaker',
    })
  }

  return result
}

export const doSignOut = async () => {
  return signOut(auth)
}

export const onAuthStateChangedListener = (callback: NextOrObserver<User>) => {
  return onAuthStateChanged(auth, callback)
}
