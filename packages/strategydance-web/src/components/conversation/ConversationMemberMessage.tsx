type Props = {
  text: string
}

/*
  What the reader wrote: a grey bubble on the right, its line breaks kept, as plain text. Knowledge
  mentions are drawn once the composer sends them
*/
function ConversationMemberMessage({ text }: Props) {
  return (
    <div className="flex max-w-[85%] min-w-0 flex-col items-end gap-1.5 self-end">
      <div className="box-border max-w-full rounded-sm bg-neutral-100 px-3 py-2 text-base leading-normal whitespace-pre-wrap text-foreground wrap-anywhere">
        {text}
      </div>
    </div>
  )
}

export default ConversationMemberMessage
