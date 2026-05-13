import { test, expect } from '@playwright/test'
import { loginUser } from './helpers/auth'
import { createTestCoach, createTestClient, sendInvite } from './helpers/api'

// ---------------------------------------------------------------------------
// Client: Dashboard states
// ---------------------------------------------------------------------------
test.describe('Client: Dashboard states', () => {
  test('клієнт бачить статус pending після запрошення від тренера', async ({ page, request }) => {
    const ts = Date.now()
    const coach = await createTestCoach(request, `_cpend_${ts}`)
    const client = await createTestClient(request, `_cpend_${ts}`)

    // Coach logs in and sends invite via API
    await loginUser(page, coach.email, coach.password)
    await sendInvite(page.request, client.nickname)

    // Client logs in and checks dashboard
    await loginUser(page, client.email, client.password)
    await page.goto('/dashboard')

    // Badge text from dashboard/page.tsx: "Очікування підтвердження"
    await expect(page.locator('text=Очікування підтвердження')).toBeVisible({ timeout: 10000 })
  })

  test('клієнт без запрошення бачить підказку із нікнеймом', async ({ page, request }) => {
    const ts = Date.now()
    const client = await createTestClient(request, `_cnone_${ts}`)

    await loginUser(page, client.email, client.password)
    await page.goto('/dashboard')

    // No invite — shows nickname hint from dashboard/page.tsx line 63-65
    await expect(page.locator(`text=@${client.nickname}`)).toBeVisible({ timeout: 10000 })
  })
})

// ---------------------------------------------------------------------------
// Client: Profile page
// ---------------------------------------------------------------------------
test.describe('Client: Profile page', () => {
  test("клієнт бачить своє ім'я та нікнейм на сторінці профілю", async ({ page, request }) => {
    const ts = Date.now()
    const client = await createTestClient(request, `_cprof_${ts}`)

    await loginUser(page, client.email, client.password)
    await page.goto('/profile')

    // Name visible — from profile/page.tsx line 19
    await expect(page.locator(`text=${client.name}`)).toBeVisible({ timeout: 10000 })
    // Nickname visible with @ prefix — from profile/page.tsx line 27
    await expect(page.locator(`text=@${client.nickname}`)).toBeVisible({ timeout: 10000 })
  })
})

// ---------------------------------------------------------------------------
// Client: Calendar
// ---------------------------------------------------------------------------
test.describe('Client: Calendar', () => {
  test('сторінка календаря завантажується і показує поточний місяць', async ({ page, request }) => {
    const ts = Date.now()
    const client = await createTestClient(request, `_ccal_${ts}`)

    await loginUser(page, client.email, client.password)
    await page.goto('/sessions')

    // MONTHS_UA array in ClientCalendar.tsx — current month May 2026 = "Травень"
    const now = new Date()
    const MONTHS_UA = [
      'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
      'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень',
    ]
    const expectedMonth = MONTHS_UA[now.getMonth()]
    await expect(page.locator(`text=${expectedMonth}`)).toBeVisible({ timeout: 10000 })
  })
})

// ---------------------------------------------------------------------------
// Client: Balance
// ---------------------------------------------------------------------------
test.describe('Client: Balance', () => {
  test('клієнт без активного тренера бачить порожній стан балансу', async ({ page, request }) => {
    const ts = Date.now()
    const client = await createTestClient(request, `_cbal_${ts}`)

    await loginUser(page, client.email, client.password)
    await page.goto('/balance')

    // Empty state text from balance/page.tsx line 34 / line 50
    await expect(page.locator('text=Немає активного балансу')).toBeVisible({ timeout: 10000 })
  })
})
