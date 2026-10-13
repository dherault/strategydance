import type { IntegrationTool } from 'strategydance-core'

/*
  A server's tools as `OrganizationIntegration.tools` keeps them, JSON text the backend wrote, or
  none when it holds no list or something unreadable: every text in them is the server's, which the
  dialog draws as plain text
*/
function parseIntegrationTools(tools: string | null | undefined): IntegrationTool[] {
  if (!tools) return []

  try {
    const parsed: unknown = JSON.parse(tools)

    return Array.isArray(parsed)
      ? parsed.filter(
          (tool): tool is IntegrationTool =>
            typeof tool === 'object'
            && tool !== null
            && typeof tool.name === 'string'
            && typeof tool.definitionHash === 'string',
        )
      : []
  } catch {
    return []
  }
}

export default parseIntegrationTools
