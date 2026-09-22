import type { Locale } from 'strategydance-core'

import getDevelopmentApiKey from '../src/getDevelopmentApiKey'
import translateMessages, { type TranslationPayloadEntry } from '../src/translateMessages'

import { type DestinationMessages, type SourceMessage, collectSourceMessages, getMessageTypes, getMessagesInput, loadExistingTranslations, prepareOutputDirectories, targetLocales, writeLocaleMessages } from './intlMessages'
import { type TranslationLock, buildLockEntry, hashParts, indexMessageLock, readLock, writeLock } from './translationLock'
import { buildMessageBatches, resolveDoneLocales } from './translationPlan'

const BATCH_CHARACTER_BUDGET = 8000

run().catch(error => {
  console.error(error)

  process.exit(1)
})

/* --- */

async function run() {
  if (!targetLocales.length) {
    console.log('No non-English locales found in SUPPORTED_LOCALES. Nothing to translate.')

    return
  }

  const messageTypes = await getMessageTypes()

  await prepareOutputDirectories()

  const messagesInput = await getMessagesInput(messageTypes)
  const sourceMessages = collectSourceMessages(messagesInput)

  const lock = await readLock()
  const lockIndex = indexMessageLock(lock)

  const hashes = new Map(sourceMessages.map(message => [message.id, hashParts(message.defaultMessage, message.description)]))

  const existing = {} as Record<Locale, Map<string, string>>

  await Promise.all(targetLocales.map(async locale => {
    existing[locale] = flattenTranslations(await loadExistingTranslations(locale, messageTypes))
  }))

  const doneLocales = new Map<string, Set<Locale>>(sourceMessages.map(message => [
    message.id,
    resolveDoneLocales(
      lockIndex.get(message.id),
      hashes.get(message.id)!,
      targetLocales,
      locale => existing[locale].has(message.id),
    ),
  ]))

  const pending = new Map<Locale, SourceMessage[]>(
    targetLocales.map(locale => [locale, sourceMessages.filter(message => !doneLocales.get(message.id)!.has(locale))]),
  )
  const pendingCount = [...pending.values()].reduce((total, messages) => total + messages.length, 0)

  console.log(`${sourceMessages.length} messages, ${pendingCount} (message, locale) pairs to translate.`)

  // Read only once something is actually going to be sent, so a run with nothing to do needs no API
  // key at all
  const apiKey = pendingCount ? getDevelopmentApiKey() : ''
  const failures: string[] = []
  const translated = new Map<Locale, Map<string, string>>()

  await Promise.all(targetLocales.map(async locale => {
    translated.set(locale, await translateToTargetLocale(apiKey, locale, pending.get(locale)!, existing[locale], failures))
  }))

  for (const locale of targetLocales) {
    const localeTranslations = translated.get(locale)!
    const destinationMessages = {} as DestinationMessages

    for (const messageType of messageTypes) destinationMessages[messageType] = {}

    for (const message of sourceMessages) {
      const value = localeTranslations.get(message.id) ?? existing[locale].get(message.id)

      /*
        No translation means no entry. react-intl renders the English `defaultMessage` for an id its
        catalogue does not carry, so nothing is lost on screen, and the gap stays visible to the
        next run. Writing the English in would be indistinguishable from a real translation, and no
        later run could ever tell it needed doing
      */
      if (value !== undefined) destinationMessages[message.messageType][message.id] = value
    }

    await writeLocaleMessages(locale, destinationMessages)
  }

  // Rebuilt from the source messages rather than mutated, so ids and message types that are gone
  // drop out
  const messages = {} as TranslationLock['messages']

  for (const message of sourceMessages) {
    const locales = doneLocales.get(message.id)!

    for (const locale of targetLocales) {
      if (translated.get(locale)!.has(message.id)) locales.add(locale)
    }

    const entry = buildLockEntry(hashes.get(message.id)!, locales)

    if (!entry) continue

    messages[message.messageType] ??= {}
    messages[message.messageType][message.id] = entry
  }

  // Written after the locale files, never before: the lock may only ever claim what is already on
  // disk
  await writeLock({ messages })

  if (failures.length) {
    console.warn(`\n${failures.length} batches failed. The messages they covered stay stale and are retried on the next run:`)

    for (const failure of failures) console.warn(`  ${failure}`)
  }

  console.log('\nMessage translation complete.')
}

/* --- */

/*
  A locale's whole catalogue keyed by id alone, never by (messageType, id).

  Ids are unique across message files, which `collectSourceMessages` throws over, and the lock is
  indexed the same way so that a message moving between message files keeps its translations.
  Probing under the message type would undo that: the translation still sits in the file the
  message left, so the new type finds nothing, every locale the lock vouches for is retired, and
  the message goes back to all six
*/
function flattenTranslations(destinationMessages: DestinationMessages): Map<string, string> {
  const flat = new Map<string, string>()

  for (const flatMessages of Object.values(destinationMessages)) {
    for (const [id, value] of Object.entries(flatMessages)) flat.set(id, value)
  }

  return flat
}

async function translateToTargetLocale(apiKey: string, locale: Locale, pendingMessages: SourceMessage[], existingForLocale: Map<string, string>, failures: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>()

  if (!pendingMessages.length) {
    console.log(`${locale}: up to date`)

    return result
  }

  const batches = buildMessageBatches(pendingMessages, BATCH_CHARACTER_BUDGET)

  console.log(`${locale}: translating ${pendingMessages.length} messages in ${batches.length} batches...`)

  for (const [index, batch] of batches.entries()) {
    const payload: TranslationPayloadEntry[] = batch.map(message => ({
      id: message.id,
      defaultMessage: message.defaultMessage,
      description: message.description,
      previousTranslation: existingForLocale.get(message.id),
    }))

    try {
      const updates = await translateMessages(apiKey, locale, payload)

      // Only what was asked for: the response schema is an open record, so the model may answer
      // with an id that does not exist
      for (const message of batch) {
        const translation = updates[message.id]

        if (translation !== undefined) result.set(message.id, translation)
      }
    }
    catch (error) {
      failures.push(`${locale} batch ${index + 1}/${batches.length}: ${(error as Error).message}`)
    }
  }

  const missing = pendingMessages.length - result.size

  if (missing) console.warn(`${locale}: ${missing} message(s) came back untranslated, they will be retried on the next run`)

  console.log(`${locale}: ${result.size}/${pendingMessages.length} translated`)

  return result
}
