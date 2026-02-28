export const APP_COSTS = {
  FootwearApp: Number(
    import.meta.env.VITE_COST_FOOTWEARAPP ??
    import.meta.env.NEXT_PUBLIC_COST_FOOTWEARAPP ??
    5
  ),
}

export const CREDIT_PACKAGES = [
  { coins: 500, price: 5.0, id: 'price_1RXLI02N8Z99lUVVCaQYZB0F' },
  { coins: 1000, price: 10.0, id: 'price_1RavfU2N8Z99lUVVYXZJLdpp' },
  { coins: 1500, price: 15.0, id: 'price_1Ravg72N8Z99lUVVWhFL3IWT' },
  { coins: 2000, price: 20.0, id: 'price_1RavgZ2N8Z99lUVVGFFeud4K' },
]
