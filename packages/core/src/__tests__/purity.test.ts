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

// Проста перевірка через source.includes(`from '${dep}'`) ловить лише голий
// специфікатор і пропускає підшляхи (`next/server`, `@atleti/db/models/User`
// тощо), динамічний import() і require(). Матчер вимагає межу одразу після
// специфікатора — підшлях (`/...`) або закривальну лапку — щоб `next` ловив
// `next/server`, але не `nextish-lib`, і `./next` не ловився хибно.
function importsForbidden(source: string, dep: string): boolean {
  const spec = dep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(from|import|require)\\s*\\(?\\s*['"]${spec}(/[^'"]*)?['"]`).test(source)
}

describe('importsForbidden — матчер специфікатора', () => {
  const cases: Array<[string, string, boolean]> = [
    ["import { NextRequest } from 'next/server'", 'next', true],
    ['import mongoose from "mongoose"', 'mongoose', true],
    ["const m = require('mongoose')", 'mongoose', true],
    ["await import('next/navigation')", 'next', true],
    ["import 'next-auth/react'", 'next-auth', true],
    ["import { User } from '@atleti/db/models/User'", '@atleti/db', true],
    ["import x from 'nextish-lib'", 'next', false],
    ["import y from './next'", 'next', false],
    ["import z from 'reactive-forms'", 'react', false],
  ]

  for (const [source, dep, expected] of cases) {
    it(`${expected ? 'ловить' : 'не ловить'}: ${source} (dep=${dep})`, () => {
      expect(importsForbidden(source, dep)).toBe(expected)
    })
  }
})

describe('межа пакета', () => {
  it('жоден модуль не імпортує серверних залежностей', () => {
    const offenders: string[] = []

    for (const file of collectSourceFiles(SRC)) {
      const source = readFileSync(file, 'utf8')
      for (const dep of FORBIDDEN) {
        if (importsForbidden(source, dep)) {
          offenders.push(`${file} → ${dep}`)
        }
      }
    }

    expect(offenders).toEqual([])
  })
})
