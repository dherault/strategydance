import { useIntl } from 'react-intl'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'strategydance-design-system/components/ui/Table'

import type { AdministrationOrganization } from '~types'

import AdministrationOrganizationRow from '~components/administration/AdministrationOrganizationRow'

import administrationMessages from '~data/intl/messages/administration'

// How many columns the table has, which the row saying it is empty spans
const COLUMN_COUNT = 5

type Props = {
  organizations: AdministrationOrganization[]
}

// Every organization, one row each, newest first, or one row saying there are none yet
function AdministrationOrganizationsTable({ organizations }: Props) {
  const { formatMessage } = useIntl()

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{formatMessage(administrationMessages.organizationsColumnName)}</TableHead>
          <TableHead align="right">{formatMessage(administrationMessages.organizationsColumnMembers)}</TableHead>
          <TableHead>{formatMessage(administrationMessages.organizationsColumnProfile)}</TableHead>
          <TableHead>{formatMessage(administrationMessages.organizationsColumnAspects)}</TableHead>
          <TableHead>{formatMessage(administrationMessages.organizationsColumnCreated)}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {organizations.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={COLUMN_COUNT}
              align="center"
              className="py-6 text-muted-foreground"
            >
              {formatMessage(administrationMessages.organizationsEmpty)}
            </TableCell>
          </TableRow>
        ) : null}
        {organizations.map(organization => (
          <AdministrationOrganizationRow
            key={organization.id}
            organization={organization}
          />
        ))}
      </TableBody>
    </Table>
  )
}

export default AdministrationOrganizationsTable
