import type { ComponentProps } from 'react'
import { useIntl } from 'react-intl'
import { Spinner as DesignSystemSpinner } from 'strategydance-design-system/components/ui/Spinner'

import globalMessages from '~data/intl/messages/global'

// The design system's spinner, announcing itself in the reader's language rather than in English
function Spinner(props: ComponentProps<typeof DesignSystemSpinner>) {
  const { formatMessage } = useIntl()

  return (
    <DesignSystemSpinner
      aria-label={formatMessage(globalMessages.loading)}
      {...props}
    />
  )
}

export default Spinner
