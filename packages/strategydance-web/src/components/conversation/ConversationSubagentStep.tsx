import useConversationRun from '~hooks/conversation/useConversationRun'

type Props = {
  subagentId: string
  // What it says while the run has written no progress line
  fallback: string
}

/*
  What a working subagent is doing, the progress line its run writes, read live while the row is at
  work, as the thinking indicator reads a conversation's, and what it was told to say until the run
  writes one
*/
function ConversationSubagentStep({ subagentId, fallback }: Props) {
  const { data: run } = useConversationRun(subagentId)

  return <>{run?.step || fallback}</>
}

export default ConversationSubagentStep
