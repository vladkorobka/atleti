# Деплой на Vercel

Проєкт — Next.js 14 (App Router) у Turborepo + pnpm workspaces. Застосунок: `apps/web`.

## 1. Передумови
- **MongoDB Atlas** (hosted) — локальний `mongodb://localhost` у serverless не працює.
  - Network Access → дозволити `0.0.0.0/0` (Vercel має динамічні IP).
  - Скопіювати connection string у `MONGODB_URI`.
- Гілка з робочим кодом запушена в GitHub (Vercel деплоїть із git).

## 2. Налаштування проєкту у Vercel
- **Import** репозиторій `vladkorobka/atleti`.
- **Root Directory** → `apps/web` (Vercel сам підхопить pnpm-workspace із кореня й `transpilePackages`).
- Framework Preset: **Next.js** (визначиться автоматично).
- Build Command / Install Command — за замовчуванням (нічого не змінювати).

## 3. Environment Variables (Vercel → Settings → Environment Variables)
| Змінна | Значення |
|---|---|
| `MONGODB_URI` | connection string Atlas |
| `NEXTAUTH_SECRET` | випадковий секрет (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | `https://<your-app>.vercel.app` |
| `AUTH_TRUST_HOST` | `true` |
| `GOOGLE_CLIENT_ID` | з Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | з Google Cloud Console |

## 4. Google OAuth
У Google Cloud Console → Credentials → OAuth client → Authorized redirect URIs додати:
```
https://<your-app>.vercel.app/api/auth/callback/google
```

## 5. Перевірка перед пушем
```bash
pnpm --filter @atleti/web build   # має завершитись успішно
```

## Примітки
- Cloudflare Stream/R2 (відео/файли) ще не реалізовані — змінні не потрібні.
- Конект до Mongo кешується на `global` (serverless-safe) — див. `packages/db/src/connection.ts`.
