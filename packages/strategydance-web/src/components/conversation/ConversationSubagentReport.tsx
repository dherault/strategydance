import { useIntl } from 'react-intl'
import { Alert } from 'strategydance-design-system/components/ui/Alert'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { CopyButton } from 'strategydance-design-system/components/ui/CopyButton'

import useConversationDocuments from '~hooks/conversation/useConversationDocuments'
import useConversationSubagentReport from '~hooks/conversation/useConversationSubagentReport'
import useConversationTasks from '~hooks/conversation/useConversationTasks'

import Spinner from '~components/common/Spinner'
import ConversationAgentMessage from '~components/conversation/ConversationAgentMessage'

import conversationMessages from '~data/intl/messages/conversation'

type Props = {
  // The conversation that launched the subagent, through which its report is read
  conversationId: string
  subagentId: string
}

/*
  What a subagent reported, in the output of the row of the call that launched it, in the Markdown
  Strategy Dance's replies are drawn in, since its links to documents and tasks are what it changed,
  with a button that copies it as written. Read as the output opens, and offered again when it could
  not be
*/
function ConversationSubagentReport({ conversationId, subagentId }: Props) {
  const { formatMessage } = useIntl()
  const {
    data: report,
    initialLoading,
    loading,
    hasFailed,
    refetch,
  } = useConversationSubagentReport(conversationId, subagentId)
  const documents = useConversationDocuments(/doc:/i.test(report ?? ''))
  const tasks = useConversationTasks(/task:/i.test(report ?? ''))

  function renderBody() {
    if (initialLoading) {
      return (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      )
    }

    if (hasFailed) {
      return (
        <div className="flex flex-col items-start gap-4">
          <Alert variant="danger">{formatMessage(conversationMessages.subagentReportLoadError)}</Alert>
          <Button
            variant="outline"
            disabled={loading}
            icon={loading ? <Spinner tone="current" /> : undefined}
            onClick={refetch}
          >
            {formatMessage(conversationMessages.retry)}
          </Button>
        </div>
      )
    }

    if (!report) {
      return (
        <p className="m-0 text-sm text-muted-foreground">{formatMessage(conversationMessages.subagentReportEmpty)}</p>
      )
    }

    return (
      <div className="min-w-0 rounded-xs border border-border bg-neutral-50 p-3">
        <ConversationAgentMessage
          text={report}
          documents={documents}
          tasks={tasks}
          size="sm"
        />
      </div>
    )
  }

  return (
    <section className="flex min-w-0 flex-col gap-2">
      <div className="flex min-h-8 items-center justify-between gap-2">
        <h3 className="m-0 font-sans text-xs font-medium tracking-wider text-muted-foreground uppercase">
          {formatMessage(conversationMessages.subagentReport)}
        </h3>
        {report ? (
          <CopyButton
            value={report}
            label={formatMessage(conversationMessages.subagentReportCopy)}
            copiedLabel={formatMessage(conversationMessages.copied)}
          />
        ) : null}
      </div>
      {renderBody()}
    </section>
  )
}

export default ConversationSubagentReport
