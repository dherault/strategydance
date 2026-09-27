import type { ReactNode } from 'react'
import { useIntl } from 'react-intl'
import { cn } from 'strategydance-design-system/lib/utils'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import accountMessages from '~data/intl/messages/account'

type Props = {
  // What the form holds, trimmed, rather than what is saved
  name: string
  bio: string
  // The picture, which picks another when clicked
  children: ReactNode
}

/*
  The reader's profile as their team sees it, following the form as it is typed: the picture, the
  name, what they do in the organization they are looking at, and the bio. An empty name or bio
  shows, greyed, what would go there
*/
function AccountProfilePreview({ name, bio, children }: Props) {
  const { formatMessage } = useIntl()
  const { organization, jobTitle } = useCurrentOrganization()

  const meta = [jobTitle, organization?.name].filter(Boolean).join(' · ')

  return (
    <aside
      aria-label={formatMessage(accountMessages.profilePreview)}
      className="flex flex-col items-center gap-4 rounded-t-xs border-b border-border bg-neutral-50 px-8 py-10 text-center md:rounded-tr-none md:border-r md:border-b-0"
    >
      {children}
      <h2 className={cn('m-0 mt-2 text-3xl leading-[1.1] wrap-anywhere', !name && 'text-neutral-400')}>
        {name || formatMessage(accountMessages.previewNameEmpty)}
      </h2>
      {meta
        ? (
            <p className="m-0 text-sm text-muted-foreground">
              {meta}
            </p>
          )
        : null}
      <p className={cn('m-0 max-w-64 text-sm leading-[1.6] text-pretty whitespace-pre-line wrap-anywhere', bio ? 'text-foreground' : 'text-neutral-400')}>
        {bio || formatMessage(accountMessages.previewBioEmpty)}
      </p>
    </aside>
  )
}

export default AccountProfilePreview
