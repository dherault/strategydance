import { type PropsWithChildren, useEffect, useState } from 'react'
import { IntlProvider, ReactIntlErrorCode, type ResolvedIntlConfig } from 'react-intl'
import { DEFAULT_LOCALE, type Locale, SUPPORTED_LOCALES } from 'strategydance-core'

import type { MessageType } from '~types'

import IntlContext, { type IntlContextType } from '~contexts/IntlContext'

import usePersistedState from '~hooks/common/usePersistedState'

type IntlMessages = Record<string, string>

type IntlMessagesModule = {
  default: IntlMessages
}

type ResolvedData = Partial<Record<Locale, Partial<Record<MessageType, IntlMessages>>>>

const PROMISE_CACHE: Partial<Record<Locale, Partial<Record<MessageType, Promise<IntlMessages>>>>> = {}

/*
  The source locale has no catalogue of its own. Its strings are the `defaultMessage`s the bundle
  already carries, so react-intl renders them with no catalogue at all, and `locales/EN` would only
  ever be a second copy of every one of them
*/
const SOURCE_LOCALE_MESSAGES: Promise<IntlMessages> = Promise.resolve({})

/*
  The path stays a relative literal rather than going through `~data`: it is what Vite's dynamic
  import analysis reads to decide which JSON files to emit as chunks, and it only does that for a
  static prefix
*/
function loadMessages(locale: Locale, messageType: MessageType): Promise<IntlMessages> {
  if (locale === DEFAULT_LOCALE) return SOURCE_LOCALE_MESSAGES

  PROMISE_CACHE[locale] ??= {}

  const cached = PROMISE_CACHE[locale]![messageType]

  if (cached) return cached

  const promise = (import(`../../data/intl/messages-translated/${locale}/${messageType}.json`) as Promise<IntlMessagesModule>)
    .then(module => module.default)
    /*
      A message catalogue added before the human `bun run translate` step has no locale file yet. An
      empty one renders every defaultMessage, instead of taking the whole app down over an
      untranslated string.

      Dropped from the cache rather than left in it, because this same catch takes every transient
      failure too: a network blip, or a chunk a deployment has moved out from under an open tab.
      Caching one of those would pin the catalogue to English for the rest of the session, with
      nothing left that could ever retry it
    */
    .catch(() => {
      delete PROMISE_CACHE[locale]![messageType]

      console.warn(`🌍 No ${locale} messages for "${messageType}" yet, falling back to the default messages`)

      return {}
    })

  PROMISE_CACHE[locale]![messageType] = promise

  return promise
}

/*
  The requested locale's catalogue, or failing that any other translated one already in hand.

  The fallback is what stops a locale switch flashing English: `loadedMessageTypes` counts a type as
  loaded once *any* locale has it, so the waiter lets the tree through while the new chunk is still
  in flight. DEFAULT_LOCALE is skipped because its entry is the empty object every catalogue
  resolves to for the source locale, which would match here and render English, which is the thing
  being avoided
*/
function findResolvedMessages(
  resolved: ResolvedData,
  messageType: MessageType,
  preferredLocale: Locale,
): IntlMessages | undefined {
  const preferred = resolved[preferredLocale]?.[messageType]

  if (preferred) return preferred

  for (const locale of SUPPORTED_LOCALES) {
    if (locale === DEFAULT_LOCALE) continue

    const fallback = resolved[locale]?.[messageType]

    if (fallback) return fallback
  }

  return undefined
}

/*
  An id a locale file has no entry for is the steady state of the incremental
  `bun run translate:messages`, not a fault: react-intl renders the English `defaultMessage`
  instead, which is exactly what the untranslated string should show. Reported as an error it would
  be one console line per missing id on every `formatMessage` call
*/
const handleIntlError: ResolvedIntlConfig['onError'] = error => {
  if (error.code === ReactIntlErrorCode.MISSING_TRANSLATION) return

  console.error(error)
}

function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && SUPPORTED_LOCALES.includes(value as Locale)
}

function getBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE

  const browserLocale = navigator.languages?.[0] ?? navigator.language
  const normalizedLocale = browserLocale.toUpperCase()
  const supportedLocale = SUPPORTED_LOCALES.find(locale => normalizedLocale.startsWith(locale))

  if (supportedLocale) return supportedLocale as Locale

  return DEFAULT_LOCALE
}

function parseLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE
}

function AppIntlProvider({ children }: PropsWithChildren) {
  const [locale, setPersistedLocale] = usePersistedState<Locale>('locale', getBrowserLocale(), { parser: parseLocale })

  const [registeredTypes, setRegisteredTypes] = useState<MessageType[]>([])
  const [resolved, setResolved] = useState<ResolvedData>({})

  function setLocale(nextLocale: Locale) {
    setPersistedLocale(parseLocale(nextLocale))
  }

  function registerMessages(nextMessageTypes: MessageType[]) {
    setRegisteredTypes(previousTypes => {
      const newTypes = nextMessageTypes.filter(type => !previousTypes.includes(type))

      if (newTypes.length === 0) return previousTypes

      return [...previousTypes, ...newTypes]
    })
  }

  useEffect(() => {
    let cancelled = false

    for (const messageType of registeredTypes) {
      loadMessages(locale, messageType)
        .then(loadedMessages => {
          if (cancelled) return

          setResolved(previous => {
            if (previous[locale]?.[messageType] === loadedMessages) return previous

            return {
              ...previous,
              [locale]: { ...previous[locale], [messageType]: loadedMessages },
            }
          })
        })
    }

    return () => {
      cancelled = true
    }
  }, [
    locale,
    registeredTypes,
  ])

  // The prerendered shell ships `lang="en"`, and it is what a screen reader announces in, what
  // hyphenation and font fallback are chosen from, and what a browser offers to translate against
  useEffect(() => {
    document.documentElement.lang = locale.toLowerCase()
  }, [
    locale,
  ])

  const messages: IntlMessages = {}

  for (const messageType of registeredTypes) {
    const typeMessages = findResolvedMessages(resolved, messageType, locale)

    if (typeMessages) Object.assign(messages, typeMessages)
  }

  const loadedMessageTypes = registeredTypes.filter(type =>
    SUPPORTED_LOCALES.some(supportedLocale => Boolean(resolved[supportedLocale]?.[type])),
  )

  const loading = registeredTypes.some(type => !resolved[locale]?.[type])

  const contextValue: IntlContextType = {
    locale,
    setLocale,
    loadedMessageTypes,
    registerMessages,
    loading,
  }

  return (
    <IntlContext.Provider value={contextValue}>
      <IntlProvider
        locale={locale}
        defaultLocale={DEFAULT_LOCALE}
        messages={messages}
        onError={handleIntlError}
      >
        {children}
      </IntlProvider>
    </IntlContext.Provider>
  )
}

export default AppIntlProvider
