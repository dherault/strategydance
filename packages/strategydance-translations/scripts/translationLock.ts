import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Locale } from 'strategydance-core'
import * as z from 'zod'

import isFileNotFound from './isFileNotFound'

/*
  An entry records the hash of the English source AND which target locales hold a translation of
  *that* hash.

  The per-locale half is what makes a failure recoverable. With one hash per id, a locale that
  drops an entry once would leave the id stale forever: every later run would re-send it to all six
  locales and regenerate the five translations that were already correct. Here only the genuine
  gaps are ever sent, so a good translation is never put back in front of the model
*/
const lockEntrySchema = z.object({
  hash: z.string(),
  // Comma-joined and sorted, eg "DE,ES,FR" — an array would blow the file up to ten lines per message
  locales: z.string(),
})

const lockFileSchema = z.object({
  messages: z.record(z.string(), z.record(z.string(), lockEntrySchema)),
})

export type LockEntry = z.infer<typeof lockEntrySchema>

export type TranslationLock = z.infer<typeof lockFileSchema>

const dirname = path.dirname(fileURLToPath(import.meta.url))

const lockFilePath = path.resolve(dirname, '../translations.lock.json')

// The NUL byte cannot appear in a source string, so no combination of parts can collide with
// another. Written as an escape rather than the raw byte: a literal NUL is invisible in an editor
// and in a diff, reads as an empty string or a space depending on the viewer, and is silently
// dropped by anything that strips control characters. Changing it rehashes all of
// translations.lock.json and retranslates the whole catalogue
const HASH_SEPARATOR = '\0'

/* --- */

// Hashes the English source a translation was made from
export function hashParts(...parts: (string | undefined)[]): string {
  return createHash('sha256')
    .update(parts.map(part => part ?? '').join(HASH_SEPARATOR))
    .digest('hex')
    .slice(0, 16)
}

export function parseLocales(entry: LockEntry | undefined, hash: string): Set<Locale> {
  // A hash mismatch invalidates every locale at once: they were all translated from source that no
  // longer exists
  if (!entry || entry.hash !== hash) return new Set()

  return new Set(entry.locales.split(',').filter(Boolean) as Locale[])
}

export function buildLockEntry(hash: string, locales: Set<Locale>): LockEntry | undefined {
  if (!locales.size) return undefined

  return {
    hash,
    locales: [...locales].sort(compareKeys).join(','),
  }
}

export async function readLock(): Promise<TranslationLock> {
  let content: string

  try {
    content = await fs.readFile(lockFilePath, 'utf-8')
  }
  catch (error) {
    // No lock file is the documented way to force a full retranslation, so it is a valid state and
    // not an error. Any other read failure is: it would start that same full retranslation without
    // anybody having asked for one
    if (!isFileNotFound(error)) throw error

    return { messages: {} }
  }

  // A corrupt lock is not: silently treating it as empty would spend a full catalogue of quota
  // without asking
  return lockFileSchema.parse(JSON.parse(content))
}

export async function writeLock(lock: TranslationLock) {
  const content = `${JSON.stringify(sortDeep(lock), null, 2)}\n`
  const temporaryPath = `${lockFilePath}.tmp`

  // Written through a rename so an interrupted run cannot leave a truncated lock behind, which
  // would read as "nothing has ever been translated"
  await fs.writeFile(temporaryPath, content, 'utf-8')
  await fs.rename(temporaryPath, lockFilePath)
}

// Flattens the message section to a single id lookup, so a message moved between message files
// keeps its entry instead of looking new. Ids are unique across message files, which
// `collectSourceMessages` asserts
export function indexMessageLock(lock: TranslationLock): Map<string, LockEntry> {
  const index = new Map<string, LockEntry>()

  for (const entries of Object.values(lock.messages)) {
    for (const [id, entry] of Object.entries(entries)) {
      index.set(id, entry)
    }
  }

  return index
}

/* --- */

// Codepoint order rather than `localeCompare`, whose result depends on the host's default locale
// and ICU version. A file the lock asserts over has to sort the same way on every machine
export function compareKeys(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1

  return 0
}

function sortDeep<T>(value: T): T {
  if (Array.isArray(value) || value === null || typeof value !== 'object') return value

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([keyA], [keyB]) => compareKeys(keyA, keyB))
    .map(([key, nested]) => [key, sortDeep(nested)])

  return Object.fromEntries(entries) as T
}
