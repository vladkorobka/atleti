import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { resolveRedirect } from '@/lib/middleware-utils'

export { resolveRedirect } from '@/lib/middleware-utils'

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
