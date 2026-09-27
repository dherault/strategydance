import { useIntl } from 'react-intl'
import { Avatar } from 'strategydance-design-system/components/ui/Avatar'
import { Badge } from 'strategydance-design-system/components/ui/Badge'
import { CopyButton } from 'strategydance-design-system/components/ui/CopyButton'
import { TableCell, TableRow } from 'strategydance-design-system/components/ui/Table'

import type { AdministrationUser } from '~types'

import authenticationProviderMessages from '~data/intl/authenticationProviderMessages'
import administrationMessages from '~data/intl/messages/administration'

type Props = {
  user: AdministrationUser
}

// One account: who they are, how to reach them, where they belong, how they sign in, and since when
function AdministrationUserRow({ user }: Props) {
  const { formatMessage, formatDate } = useIntl()

  // The name on the account, or the address when they never gave one, as the team page does
  const name = user.displayName || user.email

  return (
    <TableRow className="group/row">
      <TableCell className="sticky left-0 z-1 bg-white shadow-[inset_-1px_0_0_var(--color-neutral-200)] transition-colors duration-150 ease-in-out group-hover/row:bg-neutral-50">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar
            src={user.imageUrl ?? undefined}
            name={name}
          />
          <span className="font-medium whitespace-nowrap text-secondary">
            {name}
          </span>
          {user.isAdministrator
            ? (
                <Badge
                  variant="primary"
                  size="sm"
                >
                  {formatMessage(administrationMessages.administrator)}
                </Badge>
              )
            : null}
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {/* The button at the cell's far edge, so the buttons line up down the column */}
        <div className="flex items-center justify-between gap-2">
          <span>
            {user.email}
          </span>
          <CopyButton
            value={user.email}
            label={formatMessage(administrationMessages.copyEmail, { name })}
            copiedLabel={formatMessage(administrationMessages.emailCopied)}
          />
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {user.userOrganizations_on_user.length > 0
          ? (
              // One organization per line
              <ul className="m-0 list-none p-0">
                {user.userOrganizations_on_user.map(({ organization }) => (
                  <li key={organization.id}>
                    {organization.name}
                  </li>
                ))}
              </ul>
            )
          : formatMessage(administrationMessages.noOrganization)}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          {user.authenticationProviders.map(provider => (
            <Badge
              key={provider}
              variant="neutral"
              appearance="outline"
              size="sm"
            >
              {formatMessage(authenticationProviderMessages[provider])}
            </Badge>
          ))}
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatDate(user.createdAt, { dateStyle: 'medium' })}
      </TableCell>
    </TableRow>
  )
}

export default AdministrationUserRow
