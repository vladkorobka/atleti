export function resolveRedirect(
  pathname: string,
  session: { role?: string; nickname?: string } | null
): string | null {
  const publicPaths = ['/login', '/register', '/role-select', '/api/auth']
  if (publicPaths.some((p) => pathname.startsWith(p))) return null
  if (!session) return '/login'
  if (!session.nickname) return '/role-select'
  if (pathname.startsWith('/coach') && session.role !== 'coach') return '/dashboard'
  if (pathname.startsWith('/client') && session.role !== 'client') return '/dashboard'
  return null
}
