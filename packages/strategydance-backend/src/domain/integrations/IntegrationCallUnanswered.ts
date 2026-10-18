/*
  A call to an integration that failed without its server refusing it before running it: it timed
  out, the server could not be reached or stopped answering, or its answer could not be read, too
  large or not as an MCP server answers, so the call may have run. Its message is the sentence the call is answered with, saying to check
  before calling again, and the call is recorded as unanswered, which a subagent's parent hears of
*/
class IntegrationCallUnanswered extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IntegrationCallUnanswered'
  }
}

export default IntegrationCallUnanswered
