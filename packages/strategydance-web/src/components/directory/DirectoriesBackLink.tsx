import { Link } from '@tanstack/react-router'
import { ChevronLeftIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { CompanyAspect } from 'strategydance-database/web'
import { buttonVariants } from 'strategydance-design-system/components/ui/Button'

import useCurrentOrganizationSlug from '~hooks/organization/useCurrentOrganizationSlug'

import aspectMessages from '~data/intl/aspectMessages'

// Back to the Marketing aspect's page, which the Directories page sits under, from the top of it
function DirectoriesBackLink() {
  const { formatMessage } = useIntl()
  const organizationSlug = useCurrentOrganizationSlug()

  return (
    <Link
      to="/$organizationSlug/aspects/$aspect"
      params={{ organizationSlug, aspect: CompanyAspect.MARKETING }}
      className={buttonVariants({ variant: 'transparent', size: 'sm' })}
    >
      <ChevronLeftIcon />
      {formatMessage(aspectMessages[CompanyAspect.MARKETING])}
    </Link>
  )
}

export default DirectoriesBackLink
