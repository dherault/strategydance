import { useIntl } from 'react-intl'

import navigationMessages from '~data/intl/messages/navigation'

type Props = {
  title: string
  // Null when there is nothing to count, because the list could not be read
  lead: string | null
}

// An administration page's title, under the section's name, and a line about what it lists
function AdministrationHeader({ title, lead }: Props) {
  const { formatMessage } = useIntl()

  return (
    <header className="flex flex-col gap-3">
      <p className="m-0 text-xs font-medium tracking-wider text-muted-foreground uppercase">
        {formatMessage(navigationMessages.administration)}
      </p>
      <h1 className="m-0 text-5xl leading-[1.05]">
        {title}
      </h1>
      {lead
        ? (
            <p className="m-0 text-base leading-[1.6] text-muted-foreground">
              {lead}
            </p>
          )
        : null}
    </header>
  )
}

export default AdministrationHeader
