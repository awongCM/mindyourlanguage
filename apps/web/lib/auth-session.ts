import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export async function requireUserId(): Promise<string | NextResponse> {
  const session = await auth()
  const id = session?.user?.id
  if (!id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return id
}
