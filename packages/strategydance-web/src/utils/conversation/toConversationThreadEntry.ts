import type { ConversationPageMessage, ConversationThreadEntry } from '~types'

/*
  A message's entry in its thread, without its body, its fields always written in the same order,
  whether it came in the live tail or in a history page with its body beside it, so two entries
  compare by their JSON
*/
function toConversationThreadEntry(
  message: ConversationThreadEntry | ConversationPageMessage,
): ConversationThreadEntry {
  return {
    id: message.id,
    kind: message.kind,
    position: message.position,
    run: message.run ? { id: message.run.id } : undefined,
    createdAt: message.createdAt,
    toolName: message.toolName ?? null,
    toolStatus: message.toolStatus ?? null,
    toolDurationMs: message.toolDurationMs ?? null,
    answerSelected: message.answerSelected ?? null,
    answerOther: message.answerOther ?? null,
    isAnswerSkipped: message.isAnswerSkipped,
    answeredAt: message.answeredAt ?? null,
    aspects: message.aspects ?? null,
    aspectsSetBy: message.aspectsSetBy ?? null,
    noteKind: message.noteKind ?? null,
  }
}

export default toConversationThreadEntry
