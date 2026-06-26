import type { NextAuthConfig } from 'next-auth'
import type { AtletiSession } from '@atleti/types'

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async session({ session, token }) {
      const s = session as unknown as { user: AtletiSession }
      s.user.userId = token.userId as string
      s.user.role = token.role as AtletiSession['role']
      s.user.nickname = token.nickname as string
      s.user.emailVerified = token.emailVerified as boolean | undefined
      return session
    },
    async jwt({ token }) {
      return token
    },
  },
  providers: [],
  session: { strategy: 'jwt' },
}
