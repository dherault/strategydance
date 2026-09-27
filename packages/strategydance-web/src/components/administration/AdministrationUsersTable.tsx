import { useIntl } from 'react-intl'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from 'strategydance-design-system/components/ui/Table'

import type { AdministrationUser } from '~types'

import AdministrationUserRow from '~components/administration/AdministrationUserRow'

import administrationMessages from '~data/intl/messages/administration'

type Props = {
  users: AdministrationUser[]
}

// Every account, one row each, newest first. Never empty, since the reader is one of them
function AdministrationUsersTable({ users }: Props) {
  const { formatMessage } = useIntl()

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="sticky left-0 z-1 bg-neutral-50 shadow-[inset_-1px_0_0_var(--color-neutral-200)]">
            {formatMessage(administrationMessages.columnName)}
          </TableHead>
          <TableHead>
            {formatMessage(administrationMessages.columnEmail)}
          </TableHead>
          <TableHead>
            {formatMessage(administrationMessages.columnOrganizations)}
          </TableHead>
          <TableHead>
            {formatMessage(administrationMessages.columnSignIn)}
          </TableHead>
          <TableHead>
            {formatMessage(administrationMessages.columnJoined)}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map(user => (
          <AdministrationUserRow
            key={user.id}
            user={user}
          />
        ))}
      </TableBody>
    </Table>
  )
}

export default AdministrationUsersTable
