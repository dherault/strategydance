import { createHash } from 'node:crypto'

import toCanonicalJson from '~utils/toCanonicalJson'

type ToolDefinition = {
  name: string
  description?: string
  inputSchema: unknown
  annotations?: unknown
}

/*
  What an administrator's approval of a tool is bound to: SHA-256, in hex, of the tool's name, its
  description, its input schema and its annotations as canonical JSON, read through the MCP SDK's
  own schema, so a server that changes any of them, the text the agent reads included, lists a tool
  whose approval it lost. M29 compares a call's tool with it the same way
*/
function hashIntegrationToolDefinition({ name, description, inputSchema, annotations }: ToolDefinition) {
  return createHash('sha256').update(toCanonicalJson({ name, description, inputSchema, annotations })).digest('hex')
}

export default hashIntegrationToolDefinition
