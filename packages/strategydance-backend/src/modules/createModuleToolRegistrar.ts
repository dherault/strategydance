import type { CallToolResult, McpServer, ServerContext } from '@modelcontextprotocol/server'
import { z } from 'zod'

import type {
  ModuleAccess,
  ModuleOrganization,
  ModuleToolConfig,
  ModuleToolContext,
  ReachedModuleOrganization,
  RegisterModuleTool,
} from '~types'

import createModuleAddresses from '~modules/createModuleAddresses'
import listModuleOrganizations from '~modules/listModuleOrganizations'
import resolveModuleOrganization from '~modules/resolveModuleOrganization'
import toModuleCaller from '~modules/toModuleCaller'
import toToolRefusal from '~modules/toToolRefusal'

/*
  How the tools of a module served to external agents register on a server built for one access:
  each tool's handler runs with the context of the organization its call acts in, the caller and
  the web addresses there, built once per organization for the server's one request.

  Strategy Dance's agent acts in its run's organization, and its tools register as they are written,
  the same config and schema objects in the same order, so the tool list its requests send, which
  is pinned by its hash, never moves with this.

  An external agent's call names the organization it acts in, `organization`, among those its
  connection reaches, which the parameter's description lists. It is required even when the
  connection reaches one, so a client holding the tools of a connection since changed to reach
  another never writes there without naming it: a call naming one the connection does not reach is
  refused with the organizations it reaches now, never sent to another. The handler takes the call's
  arguments without it, so an idempotency key sent again in the same organization is the same call
*/
// The `organization` an external agent's call names, described with the organizations it may name
function toOrganizationSchema(organizations: readonly ReachedModuleOrganization[]) {
  return z
    .string()
    .min(1)
    .max(200)
    .describe(
      organizations.length > 1
        ? `The organization this call acts in, one of ${listModuleOrganizations(organizations, 'or')}. Ask the member when they have not said which.`
        : `The organization this call acts in: ${listModuleOrganizations(organizations, 'and')}, the one this connection reaches.`,
    )
}

function createModuleToolRegistrar(
  server: McpServer,
  access: ModuleAccess,
  section: 'documents' | 'tasks' | 'budget',
): RegisterModuleTool {
  const contexts = new Map<string, ModuleToolContext>()
  // Built once for the server, since every tool takes the same
  let organizationSchema: z.ZodString | undefined

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
    if (access.kind === 'agent') {
      const { organization } = access
      // Widened, since the SDK's overloads cannot tell which of them a schema left generic takes
      const registered: ModuleToolConfig<z.ZodObject, z.ZodObject> = config

      server.registerTool(name, registered, (args, serverContext) =>
        handler(args as z.output<Input>, serverContext, contextFor(organization)),
      )

      return
    }

    const { organizations } = access

    organizationSchema ??= toOrganizationSchema(organizations)

    const registered: ModuleToolConfig<z.ZodObject, z.ZodObject> = {
      ...config,
      inputSchema: config.inputSchema.extend({ organization: organizationSchema }),
    }

    server.registerTool(name, registered, ({ organization, ...args }, serverContext) => {
      const reached = resolveModuleOrganization(organizations, String(organization))

      if (!reached) {
        return Promise.resolve(
          toToolRefusal(
            `This connection does not reach ${JSON.stringify(organization)}. It reaches ${listModuleOrganizations(organizations, 'and')}: ask the member which they mean rather than act in another.`,
          ),
        )
      }

      return handler(args as z.output<Input>, serverContext, contextFor(reached))
    })
  }
}

export default createModuleToolRegistrar
