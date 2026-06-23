# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: client.spec.ts >> Client: Profile page >> клієнт бачить своє ім'я та нікнейм на сторінці профілю
- Location: e2e\client.spec.ts:42:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('input[type="email"]')

```

# Page snapshot

```yaml
- generic [active]:
  - alert [ref=e1]
  - dialog [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e6]:
        - heading "Build Error" [level=1] [ref=e7]
        - paragraph [ref=e8]: Failed to compile
        - generic [ref=e9]:
          - text: Next.js (14.2.35) is outdated
          - link "(learn more)" [ref=e11] [cursor=pointer]:
            - /url: https://nextjs.org/docs/messages/version-staleness
      - generic [ref=e12]:
        - generic [ref=e13]:
          - link "app\\(client)\\dashboard\\page.tsx" [ref=e14] [cursor=pointer]:
            - text: app\(client)\dashboard\page.tsx
            - img [ref=e15]
          - generic [ref=e20]:
            - text: "You cannot have two parallel pages that resolve to the same path. Please check /(client)/dashboard/page and /(coach)/dashboard/page. Refer to the route group docs for more information:"
            - link "https://nextjs.org/docs/app/building-your-application/routing/route-groups" [ref=e21] [cursor=pointer]:
              - /url: https://nextjs.org/docs/app/building-your-application/routing/route-groups
        - contentinfo [ref=e22]:
          - paragraph [ref=e23]: This error occurred during the build process and can only be dismissed by fixing the error.
```

# Test source

```ts
  1  | import { Page } from '@playwright/test'
  2  | 
  3  | export async function registerUser(page: Page, opts: {
  4  |   email: string
  5  |   password: string
  6  |   name: string
  7  |   role: 'coach' | 'client'
  8  |   nickname: string
  9  | }) {
  10 |   const res = await page.request.post('/api/auth/register', {
  11 |     data: opts,
  12 |   })
  13 |   return res
  14 | }
  15 | 
  16 | export async function loginUser(page: Page, email: string, password: string) {
  17 |   await page.goto('/login')
> 18 |   await page.fill('input[type="email"]', email)
     |              ^ Error: page.fill: Test timeout of 30000ms exceeded.
  19 |   await page.fill('input[type="password"]', password)
  20 |   await page.click('button[type="submit"]')
  21 |   // Wait for redirect away from /login
  22 |   await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10000 })
  23 | }
  24 | 
```