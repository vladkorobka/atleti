# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Реєстрація через UI >> показує помилку при коротко паролі
- Location: e2e\auth.spec.ts:89:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('p.text-red-500')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('p.text-red-500')

```

```yaml
- heading "Реєстрація" [level=1]
- textbox "Ім'я": User 1778704279969
- textbox "Email": user1778704279969@test.com
- textbox "Пароль (мін. 8 символів)": short
- textbox "Нікнейм (латиниця, без пробілів)": user1778704279969
- combobox:
  - option "Я — клієнт" [selected]
  - option "Я — тренер"
- button "Зареєструватись"
- paragraph:
  - text: Вже є акаунт?
  - link "Увійти":
    - /url: /login
- alert
```

# Test source

```ts
  6   |   test('coach реєструється через форму і потрапляє на dashboard', async ({ page }) => {
  7   |     const ts = Date.now()
  8   |     await page.goto('/register')
  9   | 
  10  |     await page.fill('input[placeholder="Ім\'я"]', `Coach ${ts}`)
  11  |     await page.fill('input[type="email"]', `coach${ts}@test.com`)
  12  |     await page.fill('input[placeholder="Пароль (мін. 8 символів)"]', 'password123')
  13  |     await page.fill('input[placeholder="Нікнейм (латиниця, без пробілів)"]', `coach${ts}`)
  14  |     await page.selectOption('select', 'coach')
  15  |     await page.click('button[type="submit"]')
  16  | 
  17  |     // After register → auto-login → redirect to /dashboard
  18  |     await page.waitForURL('**/dashboard', { timeout: 15000 })
  19  |     await expect(page).toHaveURL(/\/dashboard/)
  20  |   })
  21  | 
  22  |   test('client реєструється через форму і потрапляє на dashboard', async ({ page }) => {
  23  |     const ts = Date.now()
  24  |     await page.goto('/register')
  25  | 
  26  |     await page.fill('input[placeholder="Ім\'я"]', `Client ${ts}`)
  27  |     await page.fill('input[type="email"]', `client${ts}@test.com`)
  28  |     await page.fill('input[placeholder="Пароль (мін. 8 символів)"]', 'password123')
  29  |     await page.fill('input[placeholder="Нікнейм (латиниця, без пробілів)"]', `client${ts}`)
  30  |     await page.selectOption('select', 'client')
  31  |     await page.click('button[type="submit"]')
  32  | 
  33  |     // After register → auto-login → redirect to /dashboard
  34  |     await page.waitForURL('**/dashboard', { timeout: 15000 })
  35  |     await expect(page).toHaveURL(/\/dashboard/)
  36  |   })
  37  | 
  38  |   test('показує помилку при дублікаті нікнейму', async ({ page, request }) => {
  39  |     const ts = Date.now()
  40  |     const suffix = `-${ts}`
  41  | 
  42  |     // Pre-create user via API
  43  |     await registerUser(page, {
  44  |       email: `dup${ts}@test.com`,
  45  |       password: 'password123',
  46  |       name: 'Existing',
  47  |       role: 'client',
  48  |       nickname: `dupnick${ts}`,
  49  |     })
  50  | 
  51  |     // Try to register with same nickname
  52  |     await page.goto('/register')
  53  |     await page.fill('input[placeholder="Ім\'я"]', 'Another')
  54  |     await page.fill('input[type="email"]', `another${ts}@test.com`)
  55  |     await page.fill('input[placeholder="Пароль (мін. 8 символів)"]', 'password123')
  56  |     await page.fill('input[placeholder="Нікнейм (латиниця, без пробілів)"]', `dupnick${ts}`)
  57  |     await page.click('button[type="submit"]')
  58  | 
  59  |     // Error message should appear
  60  |     await expect(page.locator('p.text-red-500')).toBeVisible({ timeout: 5000 })
  61  |     await expect(page.locator('p.text-red-500')).toContainText(/нікнейм|Нікнейм/i)
  62  |   })
  63  | 
  64  |   test('показує помилку при дублікаті email', async ({ page }) => {
  65  |     const ts = Date.now()
  66  | 
  67  |     // Pre-create user via API
  68  |     await registerUser(page, {
  69  |       email: `dupemail${ts}@test.com`,
  70  |       password: 'password123',
  71  |       name: 'Existing',
  72  |       role: 'client',
  73  |       nickname: `dupemail${ts}`,
  74  |     })
  75  | 
  76  |     // Try to register with same email
  77  |     await page.goto('/register')
  78  |     await page.fill('input[placeholder="Ім\'я"]', 'Another')
  79  |     await page.fill('input[type="email"]', `dupemail${ts}@test.com`)
  80  |     await page.fill('input[placeholder="Пароль (мін. 8 символів)"]', 'password123')
  81  |     await page.fill('input[placeholder="Нікнейм (латиниця, без пробілів)"]', `unique${ts}`)
  82  |     await page.click('button[type="submit"]')
  83  | 
  84  |     // Error message should appear
  85  |     await expect(page.locator('p.text-red-500')).toBeVisible({ timeout: 5000 })
  86  |     await expect(page.locator('p.text-red-500')).toContainText(/email|Email|email/i)
  87  |   })
  88  | 
  89  |   test('показує помилку при коротко паролі', async ({ page }) => {
  90  |     const ts = Date.now()
  91  |     await page.goto('/register')
  92  | 
  93  |     await page.fill('input[placeholder="Ім\'я"]', `User ${ts}`)
  94  |     await page.fill('input[type="email"]', `user${ts}@test.com`)
  95  |     await page.fill('input[placeholder="Пароль (мін. 8 символів)"]', 'short')
  96  |     await page.fill('input[placeholder="Нікнейм (латиниця, без пробілів)"]', `user${ts}`)
  97  | 
  98  |     // Button should be disabled or validation should fail
  99  |     const submitBtn = page.locator('button[type="submit"]')
  100 |     // Try to submit anyway
  101 |     await submitBtn.click()
  102 | 
  103 |     // Either button is disabled or error appears
  104 |     const isDisabled = await submitBtn.isDisabled()
  105 |     if (!isDisabled) {
> 106 |       await expect(page.locator('p.text-red-500')).toBeVisible({ timeout: 5000 })
      |                                                    ^ Error: expect(locator).toBeVisible() failed
  107 |     }
  108 |   })
  109 | })
  110 | 
  111 | test.describe('Логін email/password', () => {
  112 |   test('coach логіниться і бачить dashboard', async ({ page, request }) => {
  113 |     const ts = Date.now()
  114 |     const coach = await createTestCoach(request, `-${ts}`)
  115 | 
  116 |     await loginUser(page, coach.email, coach.password)
  117 | 
  118 |     await expect(page).toHaveURL(/\/dashboard/)
  119 |     // Check that page loads without error
  120 |     await expect(page.locator('body')).toBeTruthy()
  121 |   })
  122 | 
  123 |   test('client логіниться і бачить dashboard', async ({ page, request }) => {
  124 |     const ts = Date.now()
  125 |     const client = await createTestClient(request, `-${ts}`)
  126 | 
  127 |     await loginUser(page, client.email, client.password)
  128 | 
  129 |     await expect(page).toHaveURL(/\/dashboard/)
  130 |     // Check that page loads without error
  131 |     await expect(page.locator('body')).toBeTruthy()
  132 |   })
  133 | 
  134 |   test('показує помилку при невірному паролі', async ({ page, request }) => {
  135 |     const ts = Date.now()
  136 |     const client = await createTestClient(request, `-${ts}`)
  137 | 
  138 |     await page.goto('/login')
  139 |     await page.fill('input[type="email"]', client.email)
  140 |     await page.fill('input[type="password"]', 'wrongpassword')
  141 |     await page.click('button[type="submit"]')
  142 | 
  143 |     // Error message should appear
  144 |     await expect(page.locator('p.text-red-500')).toBeVisible({ timeout: 5000 })
  145 |     await expect(page.locator('p.text-red-500')).toContainText(/невірний|Невірний/i)
  146 |     // Should stay on login page
  147 |     await expect(page).toHaveURL(/\/login/)
  148 |   })
  149 | 
  150 |   test('показує помилку при невідомому email', async ({ page }) => {
  151 |     await page.goto('/login')
  152 |     await page.fill('input[type="email"]', 'unknown@test.com')
  153 |     await page.fill('input[type="password"]', 'password123')
  154 |     await page.click('button[type="submit"]')
  155 | 
  156 |     // Error message should appear
  157 |     await expect(page.locator('p.text-red-500')).toBeVisible({ timeout: 5000 })
  158 |     await expect(page.locator('p.text-red-500')).toContainText(/невірний|Невірний/i)
  159 |     // Should stay on login page
  160 |     await expect(page).toHaveURL(/\/login/)
  161 |   })
  162 | 
  163 |   test('неавторизований редіректиться на /login', async ({ page }) => {
  164 |     await page.goto('/dashboard')
  165 |     await page.waitForURL('**/login', { timeout: 5000 })
  166 |     await expect(page).toHaveURL(/\/login/)
  167 |   })
  168 | 
  169 |   test('заповнені поля не теряються при помилці login', async ({ page, request }) => {
  170 |     const ts = Date.now()
  171 |     const client = await createTestClient(request, `-${ts}`)
  172 | 
  173 |     await page.goto('/login')
  174 |     await page.fill('input[type="email"]', client.email)
  175 |     await page.fill('input[type="password"]', 'wrongpassword')
  176 |     await page.click('button[type="submit"]')
  177 | 
  178 |     // Wait for error to appear
  179 |     await expect(page.locator('p.text-red-500')).toBeVisible({ timeout: 5000 })
  180 | 
  181 |     // Email should still be filled
  182 |     await expect(page.locator('input[type="email"]')).toHaveValue(client.email)
  183 |   })
  184 | })
  185 | 
  186 | test.describe('Перенаправлення після входу', () => {
  187 |   test('coach потрапляє на coach dashboard', async ({ page, request }) => {
  188 |     const ts = Date.now()
  189 |     const coach = await createTestCoach(request, `-${ts}`)
  190 | 
  191 |     await loginUser(page, coach.email, coach.password)
  192 | 
  193 |     // Should be on dashboard
  194 |     await expect(page).toHaveURL(/\/dashboard/)
  195 |     // Verify it's the coach version (if there's role-specific content)
  196 |     // This is a basic check that the page loaded
  197 |     await page.waitForLoadState('networkidle')
  198 |   })
  199 | 
  200 |   test('client потрапляє на client dashboard', async ({ page, request }) => {
  201 |     const ts = Date.now()
  202 |     const client = await createTestClient(request, `-${ts}`)
  203 | 
  204 |     await loginUser(page, client.email, client.password)
  205 | 
  206 |     // Should be on dashboard
```