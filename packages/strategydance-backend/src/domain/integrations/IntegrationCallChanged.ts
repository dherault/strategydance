/*
  A call to an integration whose approval, or auto-approval, no longer holds: the server, the tool's
  definition or the credential that makes the call changed since it was proposed, or an administrator
  took back the tool's running without approval. Its message is the sentence the call is answered
  with, so the model can propose the call again, and an approval it was waiting on is denied
*/
class IntegrationCallChanged extends Error {
  constructor(name: string, { isApprovalWithdrawn = false } = {}) {
    super(
      isApprovalWithdrawn
        ? `An administrator no longer lets this tool of ${name} run without the member's approval. Propose the call again if it is still needed: the member will be asked.`
        : `${name} changed since this call was proposed. Propose it again if it is still needed.`,
    )
    this.name = 'IntegrationCallChanged'
  }
}

export default IntegrationCallChanged
