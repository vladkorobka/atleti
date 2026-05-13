import { APIRequestContext } from '@playwright/test'

export async function createTestCoach(request: APIRequestContext, suffix = '') {
  const coach = {
    email: `coach${suffix}@e2e.test`,
    password: 'password123',
    name: `Coach${suffix}`,
    role: 'coach' as const,
    nickname: `testcoach${suffix}`,
  }
  await request.post('/api/auth/register', { data: coach })
  return coach
}

export async function createTestClient(request: APIRequestContext, suffix = '') {
  const client = {
    email: `client${suffix}@e2e.test`,
    password: 'password123',
    name: `Client${suffix}`,
    role: 'client' as const,
    nickname: `testclient${suffix}`,
  }
  await request.post('/api/auth/register', { data: client })
  return client
}

export async function sendInvite(request: APIRequestContext, clientNickname: string) {
  return request.post('/api/coach/clients/invite', { data: { nickname: clientNickname } })
}
