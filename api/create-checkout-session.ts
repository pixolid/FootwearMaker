import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'

const CREDIT_PACKAGES = [
  { coins: 500, price: 5.0, id: 'price_1RXLI02N8Z99lUVVCaQYZB0F' },
  { coins: 1000, price: 10.0, id: 'price_1RavfU2N8Z99lUVVYXZJLdpp' },
  { coins: 1500, price: 15.0, id: 'price_1Ravg72N8Z99lUVVWhFL3IWT' },
  { coins: 2000, price: 20.0, id: 'price_1RavgZ2N8Z99lUVVGFFeud4K' },
]

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-01-27.acacia' as Stripe.LatestApiVersion,
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { priceId, userId } = req.body

    const creditPackage = CREDIT_PACKAGES.find((pkg) => pkg.id === priceId)
    if (!creditPackage) {
      return res.status(400).json({ error: 'Invalid price ID' })
    }

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' })
    }

    const metadata = {
      userId,
      credits: creditPackage.coins.toString(),
      creditType: 'purchase',
      packageId: priceId,
    }

    const origin = req.headers.origin || req.headers.referer || ''

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'payment',
      success_url: `${origin}?payment=success`,
      cancel_url: `${origin}?payment=canceled`,
      metadata,
      client_reference_id: userId,
      payment_intent_data: { metadata },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true },
      automatic_tax: { enabled: true },
      locale: 'auto',
    })

    return res.status(200).json({ sessionId: session.id, url: session.url })
  } catch (error: unknown) {
    const err = error as { message: string; statusCode?: number }
    console.error('Checkout session creation failed:', err.message)
    return res.status(err.statusCode || 500).json({ error: err.message })
  }
}
