import { cn } from 'strategydance-design-system/lib/utils'

import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import BuildInPublicLogo from '~components/buildInPublic/BuildInPublicLogo'
import FitText from '~components/buildInPublic/FitText'

type Props = {
  // The largest size the name is written at, in pixels, which it shrinks from to fit
  maxSize: number
  lineHeight?: number
  className?: string
}

// The organization a card is about, its logo beside its name, which wraps to two lines and
// shrinks to fit before it is cut
function BuildInPublicOrganization({ maxSize, lineHeight = 1.25, className }: Props) {
  const { organization } = useCurrentOrganization()

  const name = organization?.name ?? ''

  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <BuildInPublicLogo
        name={name}
        logoUrl={organization?.logoUrl ?? null}
        size={28}
      />
      <FitText
        max={maxSize}
        min={11}
        lines={2}
        lineHeight={lineHeight}
        className="font-semibold"
      >
        {name}
      </FitText>
    </div>
  )
}

export default BuildInPublicOrganization
