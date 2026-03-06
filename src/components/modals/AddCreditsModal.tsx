import { useState } from 'react'
import { X, Loader2, Zap, Check } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { useAuth } from '@/hooks/useAuth'
import { CREDIT_PACKAGES } from '@/config/appCosts'

interface AddCreditsModalProps {
    open: boolean
    onClose: () => void
}

export function AddCreditsModal({ open, onClose }: AddCreditsModalProps) {
    const { isDark } = useTheme()
    const { user } = useAuth()
    const [loadingId, setLoadingId] = useState<string | null>(null)

    if (!open) return null

    const handlePurchase = async (packageId: string, credits: number) => {
        if (!user) return
        setLoadingId(packageId)
        try {
            const response = await fetch(`${import.meta.env.BASE_URL}api/create-checkout-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    priceId: packageId,
                    userId: user.uid,
                    credits,
                    mode: 'payment',
                    creditType: 'purchase',
                }),
            })

            if (!response.ok) throw new Error('Failed to create checkout session')

            const { url } = await response.json()
            if (!url) throw new Error('No checkout URL returned')
            window.location.href = url
        } catch (err) {
            console.error('Checkout error:', err)
        } finally {
            setLoadingId(null)
        }
    }

    const perCreditColor = (price: number, credits: number) => {
        const cpp = price / credits
        if (cpp <= 0.008) return 'text-emerald-400'
        if (cpp <= 0.010) return 'text-indigo-400'
        return isDark ? 'text-slate-400' : 'text-slate-500'
    }

    return (
        // Backdrop
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Panel */}
            <div
                className={`relative z-10 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden
          ${isDark ? 'bg-slate-900' : 'bg-white'}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className={`flex items-center justify-between px-6 py-5 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
                    <div>
                        <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                            Get Credits
                        </h2>
                        <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Credits are shared across all Pixolid apps · Promotional codes available at checkout
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Packages grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6">
                    {CREDIT_PACKAGES.map((pkg) => {
                        const isLoading = loadingId === pkg.id
                        const centsPerCredit = ((pkg.price / pkg.coins) * 100).toFixed(1)
                        return (
                            <div
                                key={pkg.id}
                                className={`relative flex flex-col rounded-xl border-2 p-5 transition-all
                  ${isDark
                                        ? 'bg-slate-800/60 border-white/[0.06] hover:border-indigo-500/50'
                                        : 'bg-slate-50 border-slate-200 hover:border-indigo-300'
                                    }`}
                            >
                                <div className="mb-4">
                                    <div className={`flex items-center gap-1.5 mb-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                        <Zap className="w-4 h-4 text-indigo-400" />
                                        <span className="text-xl font-bold">{pkg.coins.toLocaleString()}</span>
                                    </div>
                                    <p className={`text-[10px] font-medium ${perCreditColor(pkg.price, pkg.coins)}`}>
                                        {centsPerCredit}¢ per credit
                                    </p>
                                </div>

                                <ul className="space-y-2 mb-5 flex-1">
                                    {['Never expires', 'All Pixolid apps', 'Promo codes accepted'].map((f) => (
                                        <li key={f} className={`flex items-center gap-1.5 text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                            <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                                            {f}
                                        </li>
                                    ))}
                                </ul>

                                <div className={`text-2xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                    €{pkg.price.toFixed(2)}
                                </div>

                                <button
                                    onClick={() => handlePurchase(pkg.id, pkg.coins)}
                                    disabled={isLoading || loadingId !== null}
                                    className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all
                    disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]
                    ${isLoading
                                            ? 'bg-indigo-500/40 text-indigo-300 cursor-wait'
                                            : 'bg-indigo-500 hover:bg-indigo-600 text-white'
                                        }`}
                                >
                                    {isLoading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            Processing…
                                        </span>
                                    ) : (
                                        'Purchase'
                                    )}
                                </button>
                            </div>
                        )
                    })}
                </div>

                <div className={`px-6 pb-5 text-center text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    Secure payment via Stripe · Tax ID collection available at checkout
                </div>
            </div>
        </div>
    )
}
