import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { useAuth } from '@/hooks/useAuth'
import {
  type UserSubscription,
  PRO_PLAN_TYPES,
} from '@/types/subscription'

interface SubscriptionState {
  subscription: UserSubscription | null
  isAdmin: boolean
  isPro: boolean
  loading: boolean
}

export function useSubscription(): SubscriptionState {
  const { user, loading: authLoading } = useAuth()
  const [subscription, setSubscription] = useState<UserSubscription | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [subLoading, setSubLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setSubscription(null)
      setIsAdmin(false)
      setSubLoading(false)
      return
    }

    setSubLoading(true)

    // Listen to userSubscriptions/{userId}
    const unsubSub = onSnapshot(
      doc(db, 'userSubscriptions', user.uid),
      (snap) => {
        if (snap.exists()) {
          setSubscription(snap.data() as UserSubscription)
        } else {
          setSubscription(null)
        }
        setSubLoading(false)
      },
      () => {
        setSubscription(null)
        setSubLoading(false)
      }
    )

    // Listen to admins/{userId}
    const unsubAdmin = onSnapshot(
      doc(db, 'admins', user.uid),
      (snap) => {
        setIsAdmin(snap.exists() && snap.data()?.isAdmin === true)
      },
      () => {
        setIsAdmin(false)
      }
    )

    return () => {
      unsubSub()
      unsubAdmin()
    }
  }, [user, authLoading])

  const isPro =
    isAdmin ||
    (subscription?.status === 'active' &&
      PRO_PLAN_TYPES.includes(subscription.planType as (typeof PRO_PLAN_TYPES)[number]))

  return {
    subscription,
    isAdmin,
    isPro,
    loading: authLoading || subLoading,
  }
}
