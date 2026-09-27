import { useIntl } from 'react-intl'
import { Badge } from 'strategydance-design-system/components/ui/Badge'
import { TableCell, TableRow } from 'strategydance-design-system/components/ui/Table'

import { COMPANY_ASPECTS } from '~constants'

import type { AdministrationOrganization } from '~types'

import OrganizationMark from '~components/organization/OrganizationMark'

import administrationMessages from '~data/intl/messages/administration'

type Props = {
  organization: AdministrationOrganization
}

// One organization: what it is called, how many belong to it, who can see it, how far it has gone,
// and since when
function AdministrationOrganizationRow({ organization }: Props) {
  const { formatMessage, formatDate, formatNumber } = useIntl()

  // The count comes as one aggregate row, and an organization with no member left as none
  const memberCount = organization.members[0]?._count ?? 0

  return (
    <TableRow className="group/row">
      <TableCell className="sticky left-0 z-1 bg-white shadow-[inset_-1px_0_0_var(--color-neutral-200)] transition-colors duration-150 ease-in-out group-hover/row:bg-neutral-50">
        <div className="flex min-w-0 items-center gap-3">
          <OrganizationMark
            name={organization.name}
            logoUrl={organization.logoUrl}
            color={organization.color}
          />
          <span className="font-medium whitespace-nowrap text-secondary">
            {organization.name}
          </span>
        </div>
      </TableCell>
      <TableCell
        align="right"
        className="text-muted-foreground"
      >
        {formatNumber(memberCount)}
      </TableCell>
      <TableCell>
        <Badge
          variant={organization.isPublic ? 'success' : 'neutral'}
          size="sm"
        >
          {formatMessage(organization.isPublic ? administrationMessages.organizationPublic : administrationMessages.organizationPrivate)}
        </Badge>
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">
        {formatMessage(administrationMessages.organizationAspects, {
          explored: organization.exploredAspects.length,
          total: COMPANY_ASPECTS.length,
        })}
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">
        {formatDate(organization.createdAt, { dateStyle: 'medium' })}
      </TableCell>
    </TableRow>
  )
}

export default AdministrationOrganizationRow
