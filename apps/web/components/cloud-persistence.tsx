'use client'

import { useEffect } from 'react'
import { startBackgroundSync } from '@/lib/sync/start-background-sync'

/** Keeps this browser's history, phrasebook, and reviews in Neon. Renders nothing. */
export function CloudPersistence() {
  useEffect(() => startBackgroundSync(), [])
  return null
}
