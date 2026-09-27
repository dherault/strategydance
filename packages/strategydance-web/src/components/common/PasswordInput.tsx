import type { ComponentProps } from 'react'
import { useIntl } from 'react-intl'
import { PasswordInput as DesignSystemPasswordInput } from 'strategydance-design-system/components/ui/PasswordInput'

import globalMessages from '~data/intl/messages/global'

// The design system's password input, naming its eye in the reader's language rather than in English
function PasswordInput(props: ComponentProps<typeof DesignSystemPasswordInput>) {
  const { formatMessage } = useIntl()

  return (
    <DesignSystemPasswordInput
      showLabel={formatMessage(globalMessages.showPassword)}
      hideLabel={formatMessage(globalMessages.hidePassword)}
      {...props}
    />
  )
}

export default PasswordInput
