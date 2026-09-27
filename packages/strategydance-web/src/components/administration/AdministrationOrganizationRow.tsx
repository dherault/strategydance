import { useIntl } from 'react-intl'
import { Badge } from 'strategydance-design-system/components/ui/Badge'
import { TableCell, TableRow } from 'strategydance-design-system/components/ui/Table'
import { Tooltip } from 'strategydance-design-system/components/ui/Tooltip'

import { COMPANY_ASPECTS } from '~constants'

import type { AdministrationOrganization } from '~types'

import OrganizationMark from '~components/organization/OrganizationMark'

import aspectMessages from '~data/intl/aspectMessages'
import administrationMessages from '~data/intl/messages/administration'

type Props = {
  organization: AdministrationOrganization
}

// One organization: what it is called, how many belong to it, who can see it, how far it has gone,
// and since when
function AdministrationOrganizationRow({ organization }: Props) {
  const { formatMessage, formatDate, formatList, formatNumber } = useIntl()

  // The count comes as one aggregate row, and an organization with no member left as none
  const memberCount = organization.members[0]?._count ?? 0
  // Named in `COMPANY_ASPECTS`'s order, as the sidebar lists them. None makes an empty tooltip,
  // which the design system's leaves out
  const exploredAspectNames = COMPANY_ASPECTS
    .filter(aspect => organization.exploredAspects.includes(aspect))
    .map(aspect => formatMessage(aspectMessages[aspect]))

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
      <TableCell className="text-muted-foreground">
        <Tooltip content={formatList(exploredAspectNames)}>
          {formatMessage(administrationMessages.organizationAspects, {
            explored: exploredAspectNames.length,
            total: COMPANY_ASPECTS.length,
          })}
        </Tooltip>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatDate(organization.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
      </TableCell>
    </TableRow>
  )
}

export default AdministrationOrganizationRow
