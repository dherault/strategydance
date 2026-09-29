import { useIntl } from 'react-intl'
import { Table, TableBody, TableHead, TableHeader, TableRow } from 'strategydance-design-system/components/ui/Table'

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
          <TableHead>{formatMessage(administrationMessages.usersColumnName)}</TableHead>
          <TableHead>{formatMessage(administrationMessages.usersColumnEmail)}</TableHead>
          <TableHead>{formatMessage(administrationMessages.usersColumnOrganizations)}</TableHead>
          <TableHead>{formatMessage(administrationMessages.usersColumnSignIn)}</TableHead>
          <TableHead>{formatMessage(administrationMessages.usersColumnJoined)}</TableHead>
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
