import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Locale, SUPPORTED_LOCALES } from 'strategydance-core'

import isFileNotFound from './isFileNotFound'
import { compareKeys } from './translationLock'

// Minimal shape of a react-intl MessageDescriptor, redeclared so this package stays React-free
type SourceMessageDescriptor = {
  id?: string
  defaultMessage?: string
  description?: string
}

type SourceMessages = Record<string, SourceMessageDescriptor>

// A message type is the basename of a file in the messages directory, eg 'global'
export type MessageType = string

export type SourceMessage = {
  messageType: MessageType
  id: string
  defaultMessage: string
  description?: string
}

type FlatMessages = Record<string, string>

export type DestinationMessages = Record<MessageType, FlatMessages>

export type MessagesInput = Record<MessageType, SourceMessages>

const dirname = path.dirname(fileURLToPath(import.meta.url))

const appRoot = path.resolve(dirname, '../../frontend')
const intlDirectory = path.resolve(appRoot, 'src/data/intl')
const messagesDirectory = path.resolve(intlDirectory, 'messages')

const localesDirectory = path.resolve(intlDirectory, 'locales')

// Not exported: the source locale is only ever needed here, to subtract it from the targets
const sourceLocale = Locale.EN

export const targetLocales = SUPPORTED_LOCALES.filter(locale => locale !== sourceLocale)

/* --- */

export async function getMessageTypes(): Promise<MessageType[]> {
  const messagesDirectoryEntries = await fs.readdir(messagesDirectory)

  return messagesDirectoryEntries
    // Tests live next to the messages they cover, so a .test.ts is not a message type
    .filter(messageFileName => messageFileName.endsWith('.ts') && !messageFileName.endsWith('.test.ts'))
    .map(messageFileName => path.parse(messageFileName).name)
}

export async function getMessagesInput(messageTypes: MessageType[]): Promise<MessagesInput> {
  const allMessages = {} as MessagesInput

  for (const messageType of messageTypes) {
    const messages = await import(path.resolve(messagesDirectory, `${messageType}.ts`)).then(module => module.default) as SourceMessages

    allMessages[messageType] = messages
  }

  return allMessages
}

/*
  The flat list of every translatable message, in the order the locale files are written in.

  Ids must be unique across message files: the lock is indexed by id alone so a message that moves
  between files keeps its translations, and the payload sent to the model is flat. Nothing else
  enforces it
*/
export function collectSourceMessages(messagesInput: MessagesInput): SourceMessage[] {
  const sourceMessages: SourceMessage[] = []
  const seenIds = new Map<string, MessageType>()

  for (const [messageType, messages] of Object.entries(messagesInput)) {
    for (const descriptor of Object.values(messages)) {
      if (!descriptor || !descriptor.id || typeof descriptor.defaultMessage !== 'string') {
        console.warn(`Skipping message with no id or a non-string defaultMessage: ${messageType} ${descriptor?.id}`)

        continue
      }

      const previousMessageType = seenIds.get(descriptor.id)

      if (previousMessageType) {
        throw new Error(`Duplicate message id "${descriptor.id}" in both ${previousMessageType}.ts and ${messageType}.ts`)
      }

      seenIds.set(descriptor.id, messageType)

      sourceMessages.push({
        messageType,
        id: descriptor.id,
        defaultMessage: descriptor.defaultMessage,
        description: typeof descriptor.description === 'string' ? descriptor.description : undefined,
      })
    }
  }

  return sourceMessages
}

// The source locale is left out: its strings are the `defaultMessage`s themselves, and nothing is
// written for it
export async function prepareOutputDirectories() {
  for (const locale of targetLocales) {
    const localePath = path.resolve(localesDirectory, locale)

    await fs.mkdir(localePath, { recursive: true })
  }
}

export async function loadExistingTranslations(locale: Locale, messageTypes: MessageType[]): Promise<DestinationMessages> {
  const result = {} as DestinationMessages

  await Promise.all(messageTypes.map(async messageType => {
    const filePath = path.resolve(localesDirectory, `${locale}/${messageType}.json`)

    try {
      const content = await fs.readFile(filePath, 'utf-8')

      result[messageType] = JSON.parse(content) as FlatMessages
    }
    catch (error) {
      // A message type a locale has never been translated for has no file yet, and that is the
      // normal state for a newly added catalogue. A damaged one is not: read as empty it would be
      // re-sent to the model in full and then overwritten, losing whatever was recoverable
      if (!isFileNotFound(error)) throw error

      result[messageType] = {}
    }
  }))

  return result
}

export async function writeLocaleMessages(locale: Locale, destinationMessages: DestinationMessages) {
  await Promise.all(Object.entries(destinationMessages).map(async ([messageType, flatMessages]) => {
    const outputPath = path.resolve(localesDirectory, `${locale}/${messageType}.json`)
    const orderedOutput = Object.fromEntries(
      Object.entries(flatMessages)
        .sort(([idA], [idB]) => compareKeys(idA, idB)),
    )

    await fs.writeFile(outputPath, `${JSON.stringify(orderedOutput, null, 2)}\n`, 'utf-8')
  }))
}
