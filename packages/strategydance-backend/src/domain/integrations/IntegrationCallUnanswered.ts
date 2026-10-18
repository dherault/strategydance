/*
  A call to an integration whose server's answer never came or could not be read: it timed out, the
  server could not be reached or stopped answering, or it answered more than Strategy Dance reads, so
  the call may have run. Its message is the sentence the call is answered with, saying to check
  before calling again, and the call is recorded as unanswered, which a subagent's parent hears of
*/
class IntegrationCallUnanswered extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IntegrationCallUnanswered'
  }
}

export default IntegrationCallUnanswered
