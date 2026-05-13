import { Page } from '@playwright/test'

export async function registerUser(page: Page, opts: {
  email: string
  password: string
  name: string
  role: 'coach' | 'client'
  nickname: string
}) {
  const res = await page.request.post('/api/auth/register', {
    data: opts,
  })
  return res
}

export async function loginUser(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  // Wait for redirect away from /login
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10000 })
}
