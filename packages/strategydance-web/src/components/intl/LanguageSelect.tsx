import { useIntl } from 'react-intl'
import { Select } from 'strategydance-design-system/components/ui/Select'

import useAppIntl from '~hooks/intl/useAppIntl'

import getLocaleOptions from '~utils/intl/getLocaleOptions'

import globalMessages from '~data/intl/messages/global'

function LanguageSelect() {
  const { locale, setLocale } = useAppIntl()
  const { formatMessage } = useIntl()

  return (
    <Select
      value={locale}
      onValueChange={value => setLocale(value as typeof locale)}
      aria-label={formatMessage(globalMessages.language)}
      options={getLocaleOptions()}
      className="w-48"
    />
  )
}

export default LanguageSelect
