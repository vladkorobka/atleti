import NextAuth from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authConfig } from '@/lib/auth.config'
import { resolveRedirect } from '@/lib/middleware-utils'

const { auth } = NextAuth(authConfig)

export default auth((req: NextRequest & { auth: any }) => {
  const session = req.auth
    ? { role: req.auth.user?.role, nickname: req.auth.user?.nickname }
    : null
  const redirect = resolveRedirect(req.nextUrl.pathname, session)
  if (redirect) return NextResponse.redirect(new URL(redirect, req.url))
  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
