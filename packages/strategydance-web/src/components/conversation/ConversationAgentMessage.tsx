import { Markdown } from 'strategydance-design-system/components/ui/Markdown'

type Props = {
  text: string
}

/*
  What Strategy Dance wrote, full width, in the Markdown the thread draws, through the design
  system's `Markdown`, which keeps it to that subset and never loads an image. A link to knowledge
  reads as its words until the thread resolves them
*/
function ConversationAgentMessage({ text }: Props) {
  return (
    <Markdown
      value={text}
      size="md"
      className="wrap-anywhere text-pretty"
    />
  )
}

export default ConversationAgentMessage
