/// <reference types="vite/client" />

interface ImportMetaEnv {
  // VITE_ prefix (standard Vite convention)
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
  readonly VITE_COST_FOOTWEARAPP?: string

  // NEXT_PUBLIC_ prefix (copied from Pixogen .env.local — also exposed via envPrefix config)
  readonly NEXT_PUBLIC_FIREBASE_API_KEY?: string
  readonly NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?: string
  readonly NEXT_PUBLIC_FIREBASE_PROJECT_ID?: string
  readonly NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?: string
  readonly NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?: string
  readonly NEXT_PUBLIC_FIREBASE_APP_ID?: string
  readonly NEXT_PUBLIC_COST_FOOTWEARAPP?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
