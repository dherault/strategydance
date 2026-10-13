import type { IntegrationError } from 'strategydance-database/backend'

/*
  Why reaching an organization's MCP server failed, as one of the database's `IntegrationError`s:
  what a route answers with its code, and what a retry records. Its message is for the logs, and
  names the server's origin alone, never what the server answered, which can say anything
*/
class IntegrationFailure extends Error {
  readonly kind: IntegrationError

  constructor(kind: IntegrationError, message: string) {
    super(message)

    this.name = 'IntegrationFailure'
    this.kind = kind
  }
}

export default IntegrationFailure
