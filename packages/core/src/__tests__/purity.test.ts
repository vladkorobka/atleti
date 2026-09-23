import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

// Vitest виконує тести як ESM, де __dirname не існує — шлях беремо з import.meta.
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..')

// Дозволені залежності пакета. Усе інше — порушення межі, навіть якщо
// сьогодні воно виглядає нешкідливо: packages/core має збиратися під Metro,
// де немає ні Node-вбудованих модулів, ні DOM.
const ALLOWED = ['zod', '@atleti/types']

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      return entry === '__tests__' ? [] : collectSourceFiles(full)
    }
    return /\.tsx?$/.test(full) ? [full] : []
  })
}

// Витягує зовнішні специфікатори з усіх трьох форм: from, import(), require().
// Відносні шляхи (./, ../) пропускаються — вони всередині пакета й безпечні.
// Для scoped-пакета (@atleti/db/models/User) межа дозволу — перші два
// сегменти (@atleti/db), решта підшляху не має значення.
function externalSpecifiers(source: string): string[] {
  const found: string[] = []
  const re = /(?:from|import|require)\s*\(?\s*['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(source)) !== null) {
    const spec = m[1]
    if (spec.startsWith('./') || spec.startsWith('../')) continue
    const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]
    if (!ALLOWED.includes(pkg)) found.push(spec)
  }
  return found
}

describe('externalSpecifiers — розпізнавання специфікаторів поза межею', () => {
  const violating: string[] = [
    "import { NextRequest } from 'next/server'",
    "import mongoose from 'mongoose'",
    "import { randomUUID } from 'crypto'",
    "import { randomUUID } from 'node:crypto'",
    "import { readFileSync } from 'fs'",
    "import jwt from 'jsonwebtoken'",
    "const { MongoClient } = require('mongodb')",
    "import { User } from '@atleti/db/models/User'",
    "import { GlassCard } from '@atleti/ui'",
    "import { Platform } from 'react-native'",
    "import React from 'react'",
    "import bcrypt from 'bcryptjs'",
  ]

  for (const source of violating) {
    it(`ловить: ${source}`, () => {
      expect(externalSpecifiers(source)).not.toEqual([])
    })
  }

  const clean: string[] = [
    "import { z } from 'zod'",
    "import type { User } from '@atleti/types'",
    "import { formatTz } from './tz'",
    "import { checkOverlap } from '../slot-utils'",
    "import { clientSchema } from './validations/client'",
  ]

  for (const source of clean) {
    it(`не ловить: ${source}`, () => {
      expect(externalSpecifiers(source)).toEqual([])
    })
  }
})

describe('межа пакета', () => {
  it('жоден модуль не імпортує нічого, крім zod, @atleti/types і відносних шляхів', () => {
    const offenders: string[] = []

    for (const file of collectSourceFiles(SRC)) {
      const source = readFileSync(file, 'utf8')
      for (const spec of externalSpecifiers(source)) {
        offenders.push(`${file} → ${spec}`)
      }
    }

    expect(offenders).toEqual([])
  })
})
