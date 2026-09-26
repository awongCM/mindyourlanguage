import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { isDatabaseConfigured } from '@/lib/db'
import { ensureUserByEmail } from '@/lib/db/users'

function googleAuthConfigured(): boolean {
  return Boolean(
    process.env.AUTH_GOOGLE_ID?.trim() &&
      process.env.AUTH_GOOGLE_SECRET?.trim(),
  )
}

const providers = googleAuthConfigured()
  ? [
      Google({
        clientId: process.env.AUTH_GOOGLE_ID,
        clientSecret: process.env.AUTH_GOOGLE_SECRET,
      }),
    ]
  : []

export const isGoogleAuthEnabled = googleAuthConfigured()

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  providers,
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false
      if (!isDatabaseConfigured()) return true
      try {
        await ensureUserByEmail(user.email)
        return true
      } catch {
        return false
      }
    },
    async jwt({ token, user }) {
      if (user?.email && isDatabaseConfigured()) {
        try {
          token.userId = await ensureUserByEmail(user.email)
        } catch {
          // Session works without cloud user id when Neon is down.
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && typeof token.userId === 'string') {
        session.user.id = token.userId
      }
      return session
    },
  },
})
