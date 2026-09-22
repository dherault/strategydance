import { useIntl } from 'react-intl'
import { SUPPORTED_LOCALES } from 'strategydance-core'

import useAppIntl from '~hooks/intl/useAppIntl'

import { LOCALE_DISPLAY } from '~data/intl/constants'
import globalMessages from '~data/intl/messages/global'

function LanguageSelect() {
  const { locale, setLocale } = useAppIntl()
  const { formatMessage } = useIntl()

  return (
    <select
      value={locale}
      aria-label={formatMessage(globalMessages.language)}
      onChange={event => setLocale(event.target.value as typeof locale)}
      className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm"
    >
      {SUPPORTED_LOCALES.map(supportedLocale => (
        <option
          key={supportedLocale}
          value={supportedLocale}
        >
          {LOCALE_DISPLAY[supportedLocale].emoji}
          {' '}
          {LOCALE_DISPLAY[supportedLocale].label}
        </option>
      ))}
    </select>
  )
}

export default LanguageSelect
