import type { CallToolResult, McpServer, ServerContext } from '@modelcontextprotocol/server'
import type { z } from 'zod'

import type {
  ModuleAccess,
  ModuleOrganization,
  ModuleToolConfig,
  ModuleToolContext,
  ReachedModuleOrganization,
  RegisterModuleTool,
} from '~types'

import createModuleAddresses from '~modules/createModuleAddresses'
import toModuleCaller from '~modules/toModuleCaller'

/*
  How the tools of a module served to external agents register on a server built for one access:
  each tool's handler runs with the context of the organization its call acts in, the caller and
  the web addresses there, built once per organization for the server's one request.

  Strategy Dance's agent acts in its run's organization, and its tools register as they are written,
  the same config and schema objects in the same order, so the tool list its requests send, which
  is pinned by its hash, never moves with this
*/
function createModuleToolRegistrar(
  server: McpServer,
  access: ModuleAccess,
  section: 'documents' | 'tasks' | 'budget',
): RegisterModuleTool {
  const contexts = new Map<string, ModuleToolContext>()

  function contextFor(organization: ModuleOrganization | ReachedModuleOrganization) {
    const known = contexts.get(organization.organizationId)

    if (known) return known

    const context = {
      caller: toModuleCaller(access, organization),
      toAddress: createModuleAddresses('segment' in organization ? organization : null, section),
    }

    contexts.set(organization.organizationId, context)

    return context
  }

  return <Input extends z.ZodObject, Output extends z.ZodObject>(
    name: string,
    config: ModuleToolConfig<Input, Output>,
    handler: (
      args: z.output<Input>,
      serverContext: ServerContext,
      context: ModuleToolContext,
    ) => Promise<CallToolResult>,
  ) => {
    const organization = access.kind === 'agent' ? access.organization : access.organizations[0]

    if (!organization) throw new Error('A module was built for an access reaching no organization')

    // Widened, since the SDK's overloads cannot tell which of them a schema left generic takes
    const registered: ModuleToolConfig<z.ZodObject, z.ZodObject> = config

    server.registerTool(name, registered, (args, serverContext) =>
      handler(args as z.output<Input>, serverContext, contextFor(organization)),
    )
  }
}

export default createModuleToolRegistrar
