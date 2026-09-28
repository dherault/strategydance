import { useIntl } from 'react-intl'

import { SUPPORT_CONTACT } from '~constants'

import supportMessages from '~data/intl/messages/support'

/*
  The QR code a phone's camera opens as a chat. It is framed in white, since the image has no
  margin of its own and a scanner needs one
*/
function SupportWhatsApp() {
  const { formatMessage } = useIntl()

  return (
    <div className="flex flex-col items-center gap-3 rounded-xs border border-neutral-200 bg-neutral-50 p-4">
      <img
        src={SUPPORT_CONTACT.whatsAppQrCodeUrl}
        alt={formatMessage(supportMessages.whatsAppQrCodeAlt, { name: SUPPORT_CONTACT.name })}
        width={176}
        height={176}
        className="size-44 rounded-xs bg-white p-4 ring-1 ring-neutral-200"
      />
      <p className="max-w-[280px] text-sm leading-normal text-pretty text-muted-foreground">
        {formatMessage(supportMessages.whatsAppScan)}
      </p>
    </div>
  )
}

export default SupportWhatsApp
