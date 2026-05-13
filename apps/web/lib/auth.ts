import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { ensureDB } from './db'
import { User } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'
import { authConfig } from './auth.config'

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        await ensureDB()
        const user = await User.findOne({ email: credentials.email }).select('+passwordHash')
        if (!(user as any)?.passwordHash) return null
        const valid = await bcrypt.compare(credentials.password as string, (user as any).passwordHash)
        if (!valid) return null
        return { id: user!._id.toString(), email: user!.email, name: user!.name, image: (user as any).avatar }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      await ensureDB()
      if (account?.provider === 'google') {
        const existing = await User.findOne({ email: user.email })
        if (!existing) {
          await User.create({
            email: user.email, name: user.name, avatar: user.image,
            googleId: account.providerAccountId, role: 'client', nickname: '',
          })
        } else if (!(existing as any).googleId) {
          await User.updateOne({ _id: existing._id }, { googleId: account.providerAccountId })
        }
      }
      return true
    },
    async jwt({ token, user }) {
      if (user) {
        await ensureDB()
        const dbUser = await User.findOne({ email: token.email })
        if (dbUser) {
          token.userId = dbUser._id.toString()
          token.role = (dbUser as any).role
          token.nickname = (dbUser as any).nickname
        }
      }
      return token
    },
  },
})
