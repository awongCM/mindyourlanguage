'use client'

import { useEffect, useRef } from 'react'
import { signIn, signOut, useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { syncAllStores } from '@/lib/sync/cloud-sync'

const googleAuthUiEnabled =
  process.env.NEXT_PUBLIC_GOOGLE_AUTH === 'true'

export function AuthHeaderActions() {
  const { data: session, status } = useSession()
  const syncedForSession = useRef<string | null>(null)

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId || syncedForSession.current === userId) return
    syncedForSession.current = userId
    void syncAllStores()
  }, [session?.user?.id])

  if (!googleAuthUiEnabled) {
    return null
  }

  if (status === 'loading') {
    return (
      <Button type="button" variant="outline" size="sm" disabled>
        Sign in with Google
      </Button>
    )
  }

  if (!session?.user) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => signIn('google')}>
        Sign in with Google
      </Button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">{session.user.email}</span>
      <Button type="button" variant="outline" size="sm" onClick={() => void syncAllStores()}>
        Sync now
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => signOut()}>
        Sign out
      </Button>
    </div>
  )
}
