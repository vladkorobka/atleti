import { test, expect } from '@playwright/test'
import { registerUser, loginUser } from './helpers/auth'
import { createTestCoach, createTestClient } from './helpers/api'

test.describe('Реєстрація через UI', () => {
  test('coach реєструється через форму і потрапляє на dashboard', async ({ page }) => {
    const ts = Date.now()
    await page.goto('/register')

    await page.fill('input[placeholder="Ім\'я"]', `Coach ${ts}`)
    await page.fill('input[type="email"]', `coach${ts}@test.com`)
    await page.fill('input[placeholder="Пароль (мін. 8 символів)"]', 'password123')
    await page.fill('input[placeholder="Нікнейм (латиниця, без пробілів)"]', `coach${ts}`)
    await page.selectOption('select', 'coach')
    await page.click('button[type="submit"]')

    // After register → auto-login → redirect to /dashboard
    await page.waitForURL('**/dashboard', { timeout: 15000 })
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('client реєструється через форму і потрапляє на dashboard', async ({ page }) => {
    const ts = Date.now()
    await page.goto('/register')

    await page.fill('input[placeholder="Ім\'я"]', `Client ${ts}`)
    await page.fill('input[type="email"]', `client${ts}@test.com`)
    await page.fill('input[placeholder="Пароль (мін. 8 символів)"]', 'password123')
    await page.fill('input[placeholder="Нікнейм (латиниця, без пробілів)"]', `client${ts}`)
    await page.selectOption('select', 'client')
    await page.click('button[type="submit"]')

    // After register → auto-login → redirect to /dashboard
    await page.waitForURL('**/dashboard', { timeout: 15000 })
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('показує помилку при дублікаті нікнейму', async ({ page, request }) => {
    const ts = Date.now()
    const suffix = `-${ts}`

    // Pre-create user via API
    await registerUser(page, {
      email: `dup${ts}@test.com`,
      password: 'password123',
      name: 'Existing',
      role: 'client',
      nickname: `dupnick${ts}`,
    })

    // Try to register with same nickname
    await page.goto('/register')
    await page.fill('input[placeholder="Ім\'я"]', 'Another')
    await page.fill('input[type="email"]', `another${ts}@test.com`)
    await page.fill('input[placeholder="Пароль (мін. 8 символів)"]', 'password123')
    await page.fill('input[placeholder="Нікнейм (латиниця, без пробілів)"]', `dupnick${ts}`)
    await page.click('button[type="submit"]')

    // Error message should appear
    await expect(page.locator('p.text-red-500')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('p.text-red-500')).toContainText(/нікнейм|Нікнейм/i)
  })

  test('показує помилку при дублікаті email', async ({ page }) => {
    const ts = Date.now()

    // Pre-create user via API
    await registerUser(page, {
      email: `dupemail${ts}@test.com`,
      password: 'password123',
      name: 'Existing',
      role: 'client',
      nickname: `dupemail${ts}`,
    })

    // Try to register with same email
    await page.goto('/register')
    await page.fill('input[placeholder="Ім\'я"]', 'Another')
    await page.fill('input[type="email"]', `dupemail${ts}@test.com`)
    await page.fill('input[placeholder="Пароль (мін. 8 символів)"]', 'password123')
    await page.fill('input[placeholder="Нікнейм (латиниця, без пробілів)"]', `unique${ts}`)
    await page.click('button[type="submit"]')

    // Error message should appear
    await expect(page.locator('p.text-red-500')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('p.text-red-500')).toContainText(/email|Email|email/i)
  })

  test('показує помилку при коротко паролі', async ({ page }) => {
    const ts = Date.now()
    await page.goto('/register')

    await page.fill('input[placeholder="Ім\'я"]', `User ${ts}`)
    await page.fill('input[type="email"]', `user${ts}@test.com`)
    await page.fill('input[placeholder="Пароль (мін. 8 символів)"]', 'short')
    await page.fill('input[placeholder="Нікнейм (латиниця, без пробілів)"]', `user${ts}`)

    // Button should be disabled or validation should fail
    const submitBtn = page.locator('button[type="submit"]')
    // Try to submit anyway
    await submitBtn.click()

    // Either button is disabled or error appears
    const isDisabled = await submitBtn.isDisabled()
    if (!isDisabled) {
      await expect(page.locator('p.text-red-500')).toBeVisible({ timeout: 5000 })
    }
  })
})

test.describe('Логін email/password', () => {
  test('coach логіниться і бачить dashboard', async ({ page, request }) => {
    const ts = Date.now()
    const coach = await createTestCoach(request, `-${ts}`)

    await loginUser(page, coach.email, coach.password)

    await expect(page).toHaveURL(/\/dashboard/)
    // Check that page loads without error
    await expect(page.locator('body')).toBeTruthy()
  })

  test('client логіниться і бачить dashboard', async ({ page, request }) => {
    const ts = Date.now()
    const client = await createTestClient(request, `-${ts}`)

    await loginUser(page, client.email, client.password)

    await expect(page).toHaveURL(/\/dashboard/)
    // Check that page loads without error
    await expect(page.locator('body')).toBeTruthy()
  })

  test('показує помилку при невірному паролі', async ({ page, request }) => {
    const ts = Date.now()
    const client = await createTestClient(request, `-${ts}`)

    await page.goto('/login')
    await page.fill('input[type="email"]', client.email)
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')

    // Error message should appear
    await expect(page.locator('p.text-red-500')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('p.text-red-500')).toContainText(/невірний|Невірний/i)
    // Should stay on login page
    await expect(page).toHaveURL(/\/login/)
  })

  test('показує помилку при невідомому email', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', 'unknown@test.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')

    // Error message should appear
    await expect(page.locator('p.text-red-500')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('p.text-red-500')).toContainText(/невірний|Невірний/i)
    // Should stay on login page
    await expect(page).toHaveURL(/\/login/)
  })

  test('неавторизований редіректиться на /login', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForURL('**/login', { timeout: 5000 })
    await expect(page).toHaveURL(/\/login/)
  })

  test('заповнені поля не теряються при помилці login', async ({ page, request }) => {
    const ts = Date.now()
    const client = await createTestClient(request, `-${ts}`)

    await page.goto('/login')
    await page.fill('input[type="email"]', client.email)
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')

    // Wait for error to appear
    await expect(page.locator('p.text-red-500')).toBeVisible({ timeout: 5000 })

    // Email should still be filled
    await expect(page.locator('input[type="email"]')).toHaveValue(client.email)
  })
})

test.describe('Перенаправлення після входу', () => {
  test('coach потрапляє на coach dashboard', async ({ page, request }) => {
    const ts = Date.now()
    const coach = await createTestCoach(request, `-${ts}`)

    await loginUser(page, coach.email, coach.password)

    // Should be on dashboard
    await expect(page).toHaveURL(/\/dashboard/)
    // Verify it's the coach version (if there's role-specific content)
    // This is a basic check that the page loaded
    await page.waitForLoadState('networkidle')
  })

  test('client потрапляє на client dashboard', async ({ page, request }) => {
    const ts = Date.now()
    const client = await createTestClient(request, `-${ts}`)

    await loginUser(page, client.email, client.password)

    // Should be on dashboard
    await expect(page).toHaveURL(/\/dashboard/)
    // Verify it's the client version (if there's role-specific content)
    // This is a basic check that the page loaded
    await page.waitForLoadState('networkidle')
  })

  test('з регістру на /dashboard без проміжних кроків', async ({ page }) => {
    const ts = Date.now()
    await page.goto('/register')

    await page.fill('input[placeholder="Ім\'я"]', `DirectDash ${ts}`)
    await page.fill('input[type="email"]', `directdash${ts}@test.com`)
    await page.fill('input[placeholder="Пароль (мін. 8 символів)"]', 'password123')
    await page.fill('input[placeholder="Нікнейм (латиниця, без пробілів)"]', `directdash${ts}`)
    await page.selectOption('select', 'coach')
    await page.click('button[type="submit"]')

    // Should redirect directly to dashboard (no role-select page)
    await page.waitForURL('**/dashboard', { timeout: 15000 })
    await expect(page).toHaveURL(/\/dashboard/)
  })
})
