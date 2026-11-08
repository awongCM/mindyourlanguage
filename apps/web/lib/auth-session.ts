import { auth } from '@/lib/auth'
import { resolveAnonUser, type AnonResolution } from '@/lib/anon-identity'
import { findUserIdFromSyncPhraseCookie } from '@/lib/sync-phrase'

/**
 * Who owns the rows for this request: a signed-in Google user if there is a
 * session, otherwise a sync phrase shared across browsers, otherwise the
 * anonymous browser identity from the myl_anon cookie.
 */
export async function resolveSyncUser(options: {
  create: boolean
}): Promise<AnonResolution> {
  const session = await auth()
  const sessionUserId = session?.user?.id
  if (sessionUserId) return { kind: 'user', userId: sessionUserId }

  const syncedUserId = await findUserIdFromSyncPhraseCookie()
  if (syncedUserId) return { kind: 'user', userId: syncedUserId }

  return resolveAnonUser(options)
}
