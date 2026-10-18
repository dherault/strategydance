/*
  A call to an integration its server never answered: it timed out, or the server could not be
  reached or stopped answering, so the call may have run. Its message is the sentence the call is
  answered with, saying to check before calling again, and the call is recorded as unanswered, which
  a subagent's parent hears of
*/
class IntegrationCallUnanswered extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IntegrationCallUnanswered'
  }
}

export default IntegrationCallUnanswered
