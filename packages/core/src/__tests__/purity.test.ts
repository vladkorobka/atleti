import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

// Vitest виконує тести як ESM, де __dirname не існує — шлях беремо з import.meta.
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..')
const FORBIDDEN = ['mongoose', '@atleti/db', 'next', 'react', 'bcryptjs', 'next-auth']

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      return entry === '__tests__' ? [] : collectSourceFiles(full)
    }
    return full.endsWith('.ts') ? [full] : []
  })
}

describe('межа пакета', () => {
  it('жоден модуль не імпортує серверних залежностей', () => {
    const offenders: string[] = []

    for (const file of collectSourceFiles(SRC)) {
      const source = readFileSync(file, 'utf8')
      for (const dep of FORBIDDEN) {
        if (source.includes(`from '${dep}'`) || source.includes(`from "${dep}"`)) {
          offenders.push(`${file} → ${dep}`)
        }
      }
    }

    expect(offenders).toEqual([])
  })
})
