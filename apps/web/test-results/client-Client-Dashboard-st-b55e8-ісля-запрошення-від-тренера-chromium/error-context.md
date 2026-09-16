# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: client.spec.ts >> Client: Dashboard states >> клієнт бачить статус pending після запрошення від тренера
- Location: e2e\client.spec.ts:9:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Очікування підтвердження')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('text=Очікування підтвердження')

```

```yaml
- alert
- dialog:
  - heading "Build Error" [level=1]
  - paragraph: Failed to compile
  - text: Next.js (14.2.35) is outdated
  - link "(learn more)":
    - /url: https://nextjs.org/docs/messages/version-staleness
  - link "app\\(client)\\dashboard\\page.tsx":
    - text: app\(client)\dashboard\page.tsx
    - img
  - text: "You cannot have two parallel pages that resolve to the same path. Please check /(client)/dashboard/page and /(coach)/dashboard/page. Refer to the route group docs for more information:"
  - link "https://nextjs.org/docs/app/building-your-application/routing/route-groups":
    - /url: https://nextjs.org/docs/app/building-your-application/routing/route-groups
  - contentinfo:
    - paragraph: This error occurred during the build process and can only be dismissed by fixing the error.
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | import { loginUser } from './helpers/auth'
  3  | import { createTestCoach, createTestClient, sendInvite } from './helpers/api'
  4  | 
  5  | // ---------------------------------------------------------------------------
  6  | // Client: Dashboard states
  7  | // ---------------------------------------------------------------------------
  8  | test.describe('Client: Dashboard states', () => {
  9  |   test('клієнт бачить статус pending після запрошення від тренера', async ({ page, request }) => {
  10 |     const ts = Date.now()
  11 |     const coach = await createTestCoach(request, `_cpend_${ts}`)
  12 |     const client = await createTestClient(request, `_cpend_${ts}`)
  13 | 
  14 |     // Coach logs in and sends invite via API
  15 |     await loginUser(page, coach.email, coach.password)
  16 |     await sendInvite(page.request, client.nickname)
  17 | 
  18 |     // Client logs in and checks dashboard
  19 |     await loginUser(page, client.email, client.password)
  20 |     await page.goto('/dashboard')
  21 | 
  22 |     // Badge text from dashboard/page.tsx: "Очікування підтвердження"
> 23 |     await expect(page.locator('text=Очікування підтвердження')).toBeVisible({ timeout: 10000 })
     |                                                                 ^ Error: expect(locator).toBeVisible() failed
  24 |   })
  25 | 
  26 |   test('клієнт без запрошення бачить підказку із нікнеймом', async ({ page, request }) => {
  27 |     const ts = Date.now()
  28 |     const client = await createTestClient(request, `_cnone_${ts}`)
  29 | 
  30 |     await loginUser(page, client.email, client.password)
  31 |     await page.goto('/dashboard')
  32 | 
  33 |     // No invite — shows nickname hint from dashboard/page.tsx line 63-65
  34 |     await expect(page.locator(`text=@${client.nickname}`)).toBeVisible({ timeout: 10000 })
  35 |   })
  36 | })
  37 | 
  38 | // ---------------------------------------------------------------------------
  39 | // Client: Profile page
  40 | // ---------------------------------------------------------------------------
  41 | test.describe('Client: Profile page', () => {
  42 |   test("клієнт бачить своє ім'я та нікнейм на сторінці профілю", async ({ page, request }) => {
  43 |     const ts = Date.now()
  44 |     const client = await createTestClient(request, `_cprof_${ts}`)
  45 | 
  46 |     await loginUser(page, client.email, client.password)
  47 |     await page.goto('/profile')
  48 | 
  49 |     // Name visible — from profile/page.tsx line 19
  50 |     await expect(page.locator(`text=${client.name}`)).toBeVisible({ timeout: 10000 })
  51 |     // Nickname visible with @ prefix — from profile/page.tsx line 27
  52 |     await expect(page.locator(`text=@${client.nickname}`)).toBeVisible({ timeout: 10000 })
  53 |   })
  54 | })
  55 | 
  56 | // ---------------------------------------------------------------------------
  57 | // Client: Calendar
  58 | // ---------------------------------------------------------------------------
  59 | test.describe('Client: Calendar', () => {
  60 |   test('сторінка календаря завантажується і показує поточний місяць', async ({ page, request }) => {
  61 |     const ts = Date.now()
  62 |     const client = await createTestClient(request, `_ccal_${ts}`)
  63 | 
  64 |     await loginUser(page, client.email, client.password)
  65 |     await page.goto('/sessions')
  66 | 
  67 |     // MONTHS_UA array in ClientCalendar.tsx — current month May 2026 = "Травень"
  68 |     const now = new Date()
  69 |     const MONTHS_UA = [
  70 |       'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  71 |       'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень',
  72 |     ]
  73 |     const expectedMonth = MONTHS_UA[now.getMonth()]
  74 |     await expect(page.locator(`text=${expectedMonth}`)).toBeVisible({ timeout: 10000 })
  75 |   })
  76 | })
  77 | 
  78 | // ---------------------------------------------------------------------------
  79 | // Client: Balance
  80 | // ---------------------------------------------------------------------------
  81 | test.describe('Client: Balance', () => {
  82 |   test('клієнт без активного тренера бачить порожній стан балансу', async ({ page, request }) => {
  83 |     const ts = Date.now()
  84 |     const client = await createTestClient(request, `_cbal_${ts}`)
  85 | 
  86 |     await loginUser(page, client.email, client.password)
  87 |     await page.goto('/balance')
  88 | 
  89 |     // Empty state text from balance/page.tsx line 34 / line 50
  90 |     await expect(page.locator('text=Немає активного балансу')).toBeVisible({ timeout: 10000 })
  91 |   })
  92 | })
  93 | 
```