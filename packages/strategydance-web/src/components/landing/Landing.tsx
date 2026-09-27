import { Link } from '@tanstack/react-router'
import { FormattedMessage } from 'react-intl'
import { Badge } from 'strategydance-design-system/components/ui/Badge'
import { buttonVariants } from 'strategydance-design-system/components/ui/Button'

import LandingContainer from '~components/landing/LandingContainer'
import LandingLayout from '~components/landing/LandingLayout'

import landingMessages from '~data/intl/messages/landing'

// The public home page, as the prototype's landing has it
function Landing() {
  return (
    <LandingLayout>
      <LandingContainer className="pt-12 pb-14">
        <div className="flex max-w-[720px] flex-col items-start gap-6">
          <Badge
            variant="primary"
            dot
          >
            <FormattedMessage {...landingMessages.beta} />
          </Badge>
          <h1 className="text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.02] text-balance">
            <FormattedMessage {...landingMessages.title} />
          </h1>
          <p className="max-w-[600px] text-lg leading-[1.6] text-pretty text-muted-foreground">
            <FormattedMessage {...landingMessages.subtitle} />
          </p>
          <Link
            to="/authentication"
            className={buttonVariants({ size: 'lg' })}
          >
            <FormattedMessage {...landingMessages.start} />
          </Link>
        </div>
      </LandingContainer>
    </LandingLayout>
  )
}

export default Landing
