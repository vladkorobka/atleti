import { test, expect } from '@playwright/test'
import { loginUser } from './helpers/auth'
import { createTestCoach, createTestClient } from './helpers/api'

// ---------------------------------------------------------------------------
// Coach: Clients & Invite
// ---------------------------------------------------------------------------
test.describe('Coach: Clients & Invite', () => {
  test('coach запрошує клієнта по нікнейму', async ({ page, request }) => {
    const ts = Date.now()
    const coach = await createTestCoach(request, `_inv_${ts}`)
    const client = await createTestClient(request, `_inv_${ts}`)

    await loginUser(page, coach.email, coach.password)
    await page.goto('/clients')

    // Invite button is enabled (canInvite = true for new coach)
    await page.click('button:has-text("Запросити клієнта")')
    // GlassModal renders as a fixed overlay — wait for it
    await expect(page.locator('[role="dialog"], .fixed.inset-0')).toBeVisible()

    // Actual placeholder in InviteButton.tsx: "nickname"
    await page.fill('input[placeholder="nickname"]', client.nickname)
    await page.click('button:has-text("Надіслати запрошення")')

    // Success message in InviteButton.tsx: "Запрошення надіслано!"
    await expect(page.locator('text=Запрошення надіслано!')).toBeVisible({ timeout: 5000 })
  })

  test('клієнт зʼявляється в списку після invite', async ({ page, request }) => {
    const ts = Date.now()
    const coach = await createTestCoach(request, `_list_${ts}`)
    const client = await createTestClient(request, `_list_${ts}`)

    await loginUser(page, coach.email, coach.password)

    // Send invite via API to avoid repeating UI flow
    await page.request.post('/api/coach/clients/invite', {
      data: { nickname: client.nickname },
    })

    await page.goto('/clients')
    // Client name shown in list
    await expect(page.locator(`text=${client.name}`)).toBeVisible()
    // Status badge for pending invite
    await expect(page.locator('text=Очікує')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Coach: Balance top-up
// ---------------------------------------------------------------------------
test.describe('Coach: Balance top-up', () => {
  test('тренер поповнює баланс клієнта', async ({ page, request }) => {
    const ts = Date.now()
    const coach = await createTestCoach(request, `_bal_${ts}`)
    const client = await createTestClient(request, `_bal_${ts}`)

    await loginUser(page, coach.email, coach.password)

    // Setup: invite client and obtain clientId from response
    const inviteRes = await page.request.post('/api/coach/clients/invite', {
      data: { nickname: client.nickname },
    })
    const inviteData = await inviteRes.json()
    const clientId = inviteData.invite?.clientId

    await page.goto(`/clients/${clientId}`)

    // Button text in TopUpButton.tsx: "Поповнити баланс"
    await page.click('button:has-text("Поповнити баланс")')
    await expect(page.locator('[role="dialog"], .fixed.inset-0')).toBeVisible()

    // Number input: placeholder "Кількість занять"
    await page.fill('input[placeholder="Кількість занять"]', '8')
    // Note input: placeholder "Примітка (необов'язково)"
    await page.fill('input[placeholder*="Примітка"]', '8 тренувань')

    // Submit button text in TopUpButton.tsx: "Поповнити"
    await page.click('button:has-text("Поповнити")')

    // After reload the balance card should show 8 sessions remaining
    await expect(page.locator('text=8')).toBeVisible({ timeout: 5000 })
  })
})

// ---------------------------------------------------------------------------
// Coach: Sessions / Calendar
// ---------------------------------------------------------------------------
test.describe('Coach: Sessions', () => {
  test('тренер додає заняття в календар', async ({ page, request }) => {
    const ts = Date.now()
    const coach = await createTestCoach(request, `_cal_${ts}`)
    const client = await createTestClient(request, `_cal_${ts}`)

    await loginUser(page, coach.email, coach.password)

    // Create invite so client appears as active in CalendarClient dropdown
    await page.request.post('/api/coach/clients/invite', {
      data: { nickname: client.nickname },
    })

    await page.goto('/calendar')

    // Button label in CalendarClient.tsx when clients exist: "Додати заняття"
    await page.click('button:has-text("Додати заняття")')
    await expect(page.locator('[role="dialog"], .fixed.inset-0')).toBeVisible()

    // Select client — option format: "Name (@nickname)"
    await page.selectOption('select', { label: new RegExp(client.name) })

    // Date / time inputs (type="date" and type="time" in CalendarClient.tsx)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateStr = tomorrow.toISOString().split('T')[0]

    await page.fill('input[type="date"]', dateStr)
    await page.fill('input[type="time"]', '10:00')

    // Submit button in CalendarClient.tsx modal: "Додати заняття"
    await page.locator('[role="dialog"] button:has-text("Додати заняття"), .fixed.inset-0 button:has-text("Додати заняття")').click()

    // After session is added the calendar day button for tomorrow should be visible
    const dayNum = tomorrow.getDate().toString()
    await expect(page.locator(`button:has-text("${dayNum}")`).first()).toBeVisible({ timeout: 5000 })
  })
})

// ---------------------------------------------------------------------------
// Coach: Profile & Settings
// ---------------------------------------------------------------------------
test.describe('Coach: Profile & Settings', () => {
  test('тренер зберігає профіль', async ({ page, request }) => {
    const ts = Date.now()
    const coach = await createTestCoach(request, `_prof_${ts}`)
    await loginUser(page, coach.email, coach.password)

    await page.goto('/profile')

    // Textarea placeholder in profile/page.tsx: "Розкажіть про свій досвід та підхід до тренувань..."
    await page.fill(
      'textarea[placeholder*="Розкажіть про свій досвід"]',
      'Тренер з 5 роками досвіду',
    )

    // Specializations input placeholder: "фітнес, реабілітація, схуднення (через кому)"
    await page.fill(
      'input[placeholder*="фітнес, реабілітація"]',
      'фітнес, реабілітація',
    )

    await page.click('button[type="submit"]')

    // After save, the same submit button changes its text to "Збережено" (profile/page.tsx line 106)
    await expect(page.locator('button[type="submit"]:has-text("Збережено")')).toBeVisible({ timeout: 5000 })
  })

  test('тренер додає пакет занять', async ({ page, request }) => {
    const ts = Date.now()
    const coach = await createTestCoach(request, `_pkg_${ts}`)
    await loginUser(page, coach.email, coach.password)

    await page.goto('/settings')

    // Button in settings/page.tsx: "Додати пакет"
    await page.click('button:has-text("Додати пакет")')
    await expect(page.locator('[role="dialog"], .fixed.inset-0')).toBeVisible()

    // Name input placeholder in settings/page.tsx: "Назва (напр. «8 тренувань»)"
    await page.fill('input[placeholder*="Назва"]', '8 тренувань')

    // Sessions input placeholder: "Кількість занять"
    await page.fill('input[type="number"][placeholder="Кількість занять"]', '8')

    // Price input placeholder: "Ціна"
    await page.fill('input[placeholder="Ціна"]', '5600')

    // Submit button in modal: "Додати"
    await page.click('button:has-text("Додати")')

    // Package name should now appear in the list
    await expect(page.locator('text=8 тренувань')).toBeVisible({ timeout: 5000 })
  })
})
