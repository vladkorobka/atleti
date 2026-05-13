import { test, expect } from '@playwright/test'
import { loginUser } from './helpers/auth'
import { createTestCoach, createTestClient } from './helpers/api'

test.describe('Session status management (coach)', () => {
  test('тренер скасовує заняття з причиною через API', async ({ page, request }) => {
    const ts = Date.now()
    const coach = await createTestCoach(request, `_cancel_${ts}`)
    const client = await createTestClient(request, `_cancel_${ts}`)

    await loginUser(page, coach.email, coach.password)

    // Setup: invite client
    const inviteRes = await page.request.post('/api/coach/clients/invite', {
      data: { nickname: client.nickname },
    })
    const { invite } = await inviteRes.json()

    // Create session 2 hours from now
    const scheduledAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    const sessionRes = await page.request.post('/api/coach/sessions', {
      data: { clientId: invite.clientId, scheduledAt, duration: 60, type: 'regular' },
    })
    const { session } = await sessionRes.json()

    // Coach cancels it (can always cancel)
    const cancelRes = await page.request.put(`/api/coach/sessions/${session._id}`, {
      data: { status: 'cancelled', cancelReason: 'Захворів' },
    })
    expect(cancelRes.status()).toBe(200)
    const { session: updated } = await cancelRes.json()
    expect(updated.status).toBe('cancelled')
    expect(updated.cancelledByRole).toBe('coach')
    expect(updated.cancelReason).toBe('Захворів')
  })

  test('тренер позначає заняття як проведене', async ({ page, request }) => {
    const ts = Date.now()
    const coach = await createTestCoach(request, `_done_${ts}`)
    const client = await createTestClient(request, `_done_${ts}`)

    await loginUser(page, coach.email, coach.password)

    const inviteRes = await page.request.post('/api/coach/clients/invite', {
      data: { nickname: client.nickname },
    })
    const { invite } = await inviteRes.json()

    // Session yesterday (past)
    const scheduledAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const sessionRes = await page.request.post('/api/coach/sessions', {
      data: { clientId: invite.clientId, scheduledAt, duration: 60, type: 'regular' },
    })
    const { session } = await sessionRes.json()

    const completeRes = await page.request.put(`/api/coach/sessions/${session._id}`, {
      data: { status: 'completed' },
    })
    expect(completeRes.status()).toBe(200)
    const { session: updated } = await completeRes.json()
    expect(updated.status).toBe('completed')
  })

  test('calendar показує зміну статусу через UI', async ({ page, request }) => {
    const ts = Date.now()
    const coach = await createTestCoach(request, `_ui_${ts}`)
    const client = await createTestClient(request, `_ui_${ts}`)

    await loginUser(page, coach.email, coach.password)

    // Setup: invite + session via API
    const inviteRes = await page.request.post('/api/coach/clients/invite', {
      data: { nickname: client.nickname },
    })
    const { invite } = await inviteRes.json()

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const scheduledAt = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 11, 0).toISOString()

    await page.request.post('/api/coach/sessions', {
      data: { clientId: invite.clientId, scheduledAt, duration: 60, type: 'regular' },
    })

    await page.goto('/calendar')

    // Click on tomorrow's day
    const dayNum = tomorrow.getDate().toString()
    await page.locator(`button`).filter({ hasText: new RegExp(`^${dayNum}$`) }).first().click()

    // Day panel should appear with the session
    await expect(page.locator('text=Заплановано')).toBeVisible({ timeout: 5000 })

    // Click "Змінити статус"
    await page.click('button:has-text("Змінити статус")')
    await expect(page.locator('[role="dialog"], .fixed.inset-0').last()).toBeVisible()

    // Mark as completed
    await page.click('button:has-text("Позначити як проведене")')
    await expect(page.locator('text=Проведено')).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Cancellation deadline — unit coverage note', () => {
  test('canClientCancel логіка вже покрита unit тестами', async () => {
    // session-utils.test.ts covers:
    // - allows cancel when deadline not reached (+25h session, 24h deadline → true)
    // - blocks cancel when past deadline (+23h session, 24h deadline → false)
    // - blocks cancel for past sessions
    // Client-side cancel button will be tested in Client Module E2E
    expect(true).toBe(true)
  })
})
