import type { ReactNode } from 'react'
import { useIntl } from 'react-intl'
import { Alert } from 'strategydance-design-system/components/ui/Alert'
import { Button } from 'strategydance-design-system/components/ui/Button'

import Spinner from '~components/common/Spinner'
import PageSection from '~components/layout/PageSection'

import buildInPublicMessages from '~data/intl/messages/buildInPublic'

type Failure = {
  message: string
  isRetrying: boolean
  onRetry: () => void
}

type Props = {
  title: string
  description: string
  // What the section could not read, shown with a way to try again in place of its cards
  failure?: Failure | null
  children: ReactNode
}

/*
  One section of the build in public page, its cards one under the other. Its head stays in view
  while the cards scroll under it, below the bar that opens the sidebar on a narrow screen
*/
function BuildInPublicSection({ title, description, failure, children }: Props) {
  const { formatMessage } = useIntl()

  return (
    <PageSection
      title={title}
      description={description}
      className="gap-8"
      headClassName="sticky top-0 z-[2] -mt-4 -mb-1 bg-background pt-4 pb-1 max-md:top-12"
    >
      {failure ? (
        <div className="flex flex-col items-start gap-4">
          <Alert
            variant="danger"
            className="max-w-xl"
          >
            {failure.message}
          </Alert>
          <Button
            variant="outline"
            disabled={failure.isRetrying}
            icon={failure.isRetrying ? <Spinner tone="current" /> : undefined}
            onClick={failure.onRetry}
          >
            {formatMessage(buildInPublicMessages.retry)}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-24">{children}</div>
      )}
    </PageSection>
  )
}

export default BuildInPublicSection
