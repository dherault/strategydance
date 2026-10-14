import type { IntegrationTool } from 'strategydance-core'

/*
  A server's tools as `OrganizationIntegration.tools` keeps them, JSON text `reachIntegration` wrote,
  or none when it holds no list yet, as an OAuth server's before its first connection. Every text in
  them is the server's: the agent reads it as data, never as instructions
*/
function parseStoredIntegrationTools(tools: string | null | undefined): IntegrationTool[] | null {
  if (!tools) return null

  const parsed: unknown = JSON.parse(tools)

  if (!Array.isArray(parsed)) throw new Error("A server's stored tools are not a list")

  return parsed.filter(
    (tool): tool is IntegrationTool =>
      typeof tool === 'object'
      && tool !== null
      && typeof tool.name === 'string'
      && typeof tool.definitionHash === 'string',
  )
}

export default parseStoredIntegrationTools
