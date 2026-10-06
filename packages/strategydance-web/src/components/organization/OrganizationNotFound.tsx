import { Link, type LinkProps } from '@tanstack/react-router'
import { Building2Icon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { buttonVariants } from 'strategydance-design-system/components/ui/Button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from 'strategydance-design-system/components/ui/Empty'

import ContainerLayout from '~components/layout/ContainerLayout'

import navigationMessages from '~data/intl/messages/navigation'

type Props = {
  // An organization the reader is in, to go to instead, with where its page is
  fallback: { organizationName: string; link: LinkProps } | null
}

/*
  What a path shows when it leads with an organization the reader is not in: one that was deleted,
  one they were removed from, one they were never invited to, or a slug mistyped. They are told the
  same in each case, so the page says nothing of whether an organization exists that they cannot
  see.

  In the app's frame rather than full screen, so the sidebar's switcher is still at hand, and with
  a way to the organization the sidebar shows
*/
function OrganizationNotFound({ fallback }: Props) {
  const { formatMessage } = useIntl()

  return (
    <ContainerLayout>
      <Empty>
        <EmptyHeader>
          <EmptyMedia>
            <Building2Icon />
          </EmptyMedia>
          <EmptyTitle>{formatMessage(navigationMessages.organizationNotFoundTitle)}</EmptyTitle>
          <EmptyDescription>{formatMessage(navigationMessages.organizationNotFoundText)}</EmptyDescription>
        </EmptyHeader>
        {fallback ? (
          <EmptyContent>
            <Link
              {...fallback.link}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              {formatMessage(navigationMessages.organizationNotFoundAction, {
                organizationName: fallback.organizationName,
              })}
            </Link>
          </EmptyContent>
        ) : null}
      </Empty>
    </ContainerLayout>
  )
}

export default OrganizationNotFound
