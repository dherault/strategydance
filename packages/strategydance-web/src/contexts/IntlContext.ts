import { createContext } from 'react'
import { DEFAULT_LOCALE, type Locale } from 'strategydance-core'

import type { MessageType } from '~types'

export type IntlContextType = {
  locale: Locale
  setLocale: (locale: Locale) => void
  loadedMessageTypes: MessageType[]
  registerMessages: (messageTypes: MessageType[]) => void
  loading: boolean
}

export default createContext<IntlContextType>({
  locale: DEFAULT_LOCALE as Locale,
  setLocale: () => {},
  loadedMessageTypes: [],
  registerMessages: () => {},
  loading: false,
})
