'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'

const STORAGE_KEY = 'myl-onboarding-sync-done'

export function OnboardingSyncHint() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!session?.user?.id) return
    if (typeof window === 'undefined') return
    if (window.localStorage.getItem(STORAGE_KEY) === '1') return
    setOpen(true)
  }, [session?.user?.id])

  if (!open) return null

  function dismiss() {
    window.localStorage.setItem(STORAGE_KEY, '1')
    setOpen(false)
  }

  return (
    <div
      role="dialog"
      aria-labelledby="onboarding-sync-title"
      className="mx-auto mt-3 w-full max-w-5xl rounded-md border border-border bg-muted/40 px-4 py-3 sm:px-6"
    >
      <p id="onboarding-sync-title" className="text-sm font-medium text-foreground">
        Sign in syncs phrasebook and practice across devices.
      </p>
      <div className="mt-2">
        <Button type="button" size="sm" variant="secondary" onClick={dismiss}>
          Got it
        </Button>
      </div>
    </div>
  )
}
