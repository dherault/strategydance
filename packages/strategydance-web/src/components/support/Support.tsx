import { CalendarDaysIcon, MailIcon, MessageCircleIcon } from 'lucide-react'
import { useId, useState } from 'react'
import { useIntl } from 'react-intl'
import { Avatar } from 'strategydance-design-system/components/ui/Avatar'
import { Button, buttonVariants } from 'strategydance-design-system/components/ui/Button'
import { Card } from 'strategydance-design-system/components/ui/Card'
import { cn } from 'strategydance-design-system/lib/utils'

import { SUPPORT_CONTACT } from '~constants'

import LandingLayout from '~components/landing/LandingLayout'
import SupportEmail from '~components/support/SupportEmail'
import SupportHeaderActions from '~components/support/SupportHeaderActions'
import SupportReveal from '~components/support/SupportReveal'
import SupportWhatsApp from '~components/support/SupportWhatsApp'

import supportMessages from '~data/intl/messages/support'

// X's own mark, since Lucide draws no brand's
function XMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </svg>
  )
}

// The support page, as the prototype has it: the founder's card, with every way to reach them
function Support() {
  const { formatMessage } = useIntl()
  const [isWhatsAppShown, setIsWhatsAppShown] = useState(false)
  const [isEmailShown, setIsEmailShown] = useState(false)
  const whatsAppId = useId()
  const emailId = useId()

  return (
    <LandingLayout
      headerActions={<SupportHeaderActions />}
      className="justify-center border-t border-neutral-200 bg-neutral-50 px-4 pt-6 pb-10 sm:px-6 sm:pt-12 sm:pb-16"
    >
      <Card className="w-full max-w-[520px] items-center gap-0 px-5 pt-10 pb-6 text-center sm:px-10 sm:pt-12 sm:pb-10">
        {/* Decorative, since the name is the heading right under it */}
        <Avatar
          src={SUPPORT_CONTACT.pictureUrl}
          name={SUPPORT_CONTACT.name}
          alt=""
          className="size-30 text-4xl ring-1 ring-neutral-200 ring-offset-4 ring-offset-white"
        />
        <p className="mt-8 text-xs font-medium tracking-wider text-muted-foreground uppercase">
          {formatMessage(supportMessages.eyebrow)}
        </p>
        {/* A name, so it is written as it is rather than translated */}
        <h1 className="mt-2 text-4xl leading-[1.1]">{SUPPORT_CONTACT.name}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{formatMessage(supportMessages.role)}</p>
        <p className="mt-6 max-w-[380px] leading-[1.6] text-pretty">{formatMessage(supportMessages.lead)}</p>
        <div className="mt-8 flex w-full flex-col gap-2">
          <a
            href={SUPPORT_CONTACT.calendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ size: 'lg' }), 'w-full')}
          >
            <CalendarDaysIcon />
            {formatMessage(supportMessages.bookMeeting)}
          </a>
          {/*
            A row that wraps rather than three equal columns, since a translation can run longer
            than a third of the card: "Message on X" is "Envoyer un message sur X" in French
          */}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <a
              href={SUPPORT_CONTACT.xUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: 'outline' }), 'flex-auto')}
            >
              <XMark />
              {formatMessage(supportMessages.messageOnX)}
            </a>
            <Button
              variant="outline"
              icon={<MessageCircleIcon />}
              className="flex-auto"
              aria-expanded={isWhatsAppShown}
              aria-controls={whatsAppId}
              onClick={() => setIsWhatsAppShown(isShown => !isShown)}
            >
              {formatMessage(supportMessages.whatsApp)}
            </Button>
            <Button
              variant="outline"
              icon={<MailIcon />}
              className="flex-auto"
              aria-expanded={isEmailShown}
              aria-controls={emailId}
              onClick={() => setIsEmailShown(isShown => !isShown)}
            >
              {formatMessage(isEmailShown ? supportMessages.hideEmail : supportMessages.showEmail)}
            </Button>
          </div>
        </div>
        <SupportReveal
          id={whatsAppId}
          isShown={isWhatsAppShown}
        >
          <SupportWhatsApp />
        </SupportReveal>
        <SupportReveal
          id={emailId}
          isShown={isEmailShown}
        >
          <SupportEmail />
        </SupportReveal>
      </Card>
    </LandingLayout>
  )
}

export default Support
