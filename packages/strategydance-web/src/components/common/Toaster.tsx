import type { ComponentProps } from 'react'
import { useIntl } from 'react-intl'
import { Toaster as DesignSystemToaster } from 'strategydance-design-system/components/ui/Toaster'

import globalMessages from '~data/intl/messages/global'

// The design system's toaster, naming its region and its close buttons in the reader's language
// rather than in Sonner's English
function Toaster({ toastOptions, ...props }: ComponentProps<typeof DesignSystemToaster>) {
  const { formatMessage } = useIntl()

  return (
    <DesignSystemToaster
      containerAriaLabel={formatMessage(globalMessages.notifications)}
      toastOptions={{
        closeButtonAriaLabel: formatMessage(globalMessages.closeNotification),
        ...toastOptions,
      }}
      {...props}
    />
  )
}

export default Toaster
