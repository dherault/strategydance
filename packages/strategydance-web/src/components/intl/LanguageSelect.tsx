import { useIntl } from 'react-intl'
import { SUPPORTED_LOCALES } from 'strategydance-core'
import { Select } from 'strategydance-design-system/components/ui/Select'

import useAppIntl from '~hooks/intl/useAppIntl'

import { LOCALE_DISPLAY } from '~data/intl/constants'
import globalMessages from '~data/intl/messages/global'

function LanguageSelect() {
  const { locale, setLocale } = useAppIntl()
  const { formatMessage } = useIntl()

  return (
    <Select
      value={locale}
      onValueChange={value => setLocale(value as typeof locale)}
      aria-label={formatMessage(globalMessages.language)}
      options={SUPPORTED_LOCALES.map(supportedLocale => ({
        value: supportedLocale,
        label: `${LOCALE_DISPLAY[supportedLocale].emoji} ${LOCALE_DISPLAY[supportedLocale].label}`,
      }))}
      className="w-48"
    />
  )
}

export default LanguageSelect
