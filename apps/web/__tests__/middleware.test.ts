import { describe, it, expect } from 'vitest'
import { resolveRedirect } from '../lib/middleware-utils'

describe('middleware redirect logic', () => {
  it('redirects unauthenticated user to login', () => {
    expect(resolveRedirect('/dashboard', null)).toBe('/login')
  })

  it('allows unauthenticated access to /login', () => {
    expect(resolveRedirect('/login', null)).toBeNull()
  })

  it('allows unauthenticated access to password reset pages', () => {
    expect(resolveRedirect('/forgot-password', null)).toBeNull()
    expect(resolveRedirect('/reset-password', null)).toBeNull()
  })

  it('allows unauthenticated access to email verification page', () => {
    expect(resolveRedirect('/verify-email', null)).toBeNull()
  })

  it('redirects user without nickname to role-select', () => {
    expect(resolveRedirect('/dashboard', { role: 'coach', nickname: '' })).toBe('/role-select')
  })

  it('blocks client from /coach routes', () => {
    expect(resolveRedirect('/coach/dashboard', { role: 'client', nickname: 'test' })).toBe('/')
  })

  it('blocks coach from /client routes', () => {
    expect(resolveRedirect('/client/dashboard', { role: 'coach', nickname: 'test' })).toBe('/')
  })

  it('allows coach to access /coach routes', () => {
    expect(resolveRedirect('/coach/dashboard', { role: 'coach', nickname: 'test' })).toBeNull()
  })
})
