// Whether a write of the Knowledge module failed on one of its operation's checks, by a part of the
// message that check gives, as Data Connect puts it in the error
function isKnowledgeRefusal(error: unknown, message: string) {
  return error instanceof Error && error.message.includes(message)
}

export default isKnowledgeRefusal
