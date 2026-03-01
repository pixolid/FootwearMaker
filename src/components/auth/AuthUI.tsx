import { useState } from 'react'
import { doSignInWithGoogle } from '@/firebase/auth'
import { Loader2 } from 'lucide-react'

export function AuthUI() {
  const [error, setError] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const handleGoogleSignIn = async () => {
    setError('')
    setIsProcessing(true)

    try {
      await doSignInWithGoogle()
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string }
      if (firebaseErr.code === 'auth/popup-closed-by-user') {
        setError('Sign in was cancelled')
      } else if (firebaseErr.code === 'auth/popup-blocked') {
        setError('Pop-up was blocked. Please allow pop-ups and try again.')
      } else {
        setError('Authentication failed. Please try again.')
      }
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950" />

      {/* Top-left logo */}
      <img
        src="/FootwearMaker/pixogen_logo2.png"
        alt="Pixogen"
        className="absolute top-6 left-6 w-[200px] h-[80px] object-contain invert z-10"
      />

      {/* Glass card */}
      <div className="relative z-10 w-full max-w-md mx-4 p-8 rounded-[2rem] bg-slate-900/80 border border-white/10 backdrop-blur-xl shadow-2xl">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">Welcome to FootwearMaker</h1>
          <p className="text-sm text-slate-400 mt-1">
            Design and modify footwear in 3D
          </p>
        </div>

        {/* Sign In Button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={isProcessing}
          className="w-full flex items-center justify-center gap-3 bg-white text-slate-800
            px-6 py-3.5 rounded-xl font-medium text-sm
            hover:bg-slate-50 active:scale-[0.98] transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <img
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
              alt="Google"
              className="w-5 h-5"
            />
          )}
          {isProcessing ? 'Signing in...' : 'Continue with Google'}
        </button>

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400 text-center">{error}</p>
          </div>
        )}

        {/* Footer */}
        <p className="text-xs text-slate-500 text-center mt-6">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  )
}
