import type { Locale } from 'strategydance-core'

import type { SourceMessage } from './intlMessages'
import { type LockEntry, parseLocales } from './translationLock'

/*
  Which target locales already hold a translation of this exact English source, and so can be
  skipped.

  Two things can retire a locale the lock vouches for. One is the locale leaving SUPPORTED_LOCALES,
  which should take its entry with it. The other is the translation no longer being on disk: the
  catalogue is the artifact the lock describes, so deleting a locale file, or one line of it, is
  how you ask for just that to be redone
*/
export function resolveDoneLocales(entry: LockEntry | undefined, hash: string, targetLocales: Locale[], hasTranslation: (locale: Locale) => boolean): Set<Locale> {
  const locales = parseLocales(entry, hash)

  for (const locale of locales) {
    if (!targetLocales.includes(locale) || !hasTranslation(locale)) locales.delete(locale)
  }

  return locales
}

/*
  The model returns every id it is given, so a response is roughly as large as its request and an
  oversized batch comes back truncated. Budgeted in characters rather than entries because one
  message ranges from a word to a paragraph. A message larger than the whole budget still gets a
  batch of its own rather than being dropped
*/
export function buildMessageBatches(messages: SourceMessage[], characterBudget: number): SourceMessage[][] {
  const batches: SourceMessage[][] = []

  let batch: SourceMessage[] = []
  let batchSize = 0

  for (const message of messages) {
    const messageSize = message.id.length + message.defaultMessage.length + (message.description?.length ?? 0)

    if (batch.length && batchSize + messageSize > characterBudget) {
      batches.push(batch)

      batch = []
      batchSize = 0
    }

    batch.push(message)
    batchSize += messageSize
  }

  if (batch.length) batches.push(batch)

  return batches
}
