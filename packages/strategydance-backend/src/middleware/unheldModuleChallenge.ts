import { bearerAuthChallengeResponse, OAuthError, OAuthErrorCode } from '@modelcontextprotocol/server'
import type { NextFunction, Request, Response } from 'express'
import { type ModuleAddress, MODULES, type ModuleScope } from 'strategydance-core'

import findToolModule from '~modules/findToolModule'
import readModuleAccess from '~modules/readModuleAccess'
import toModuleScopeChallenge from '~modules/toModuleScopeChallenge'

// The tools a JSON-RPC body calls, one message or a batch, as a 2025-03-26 client may send
function readCalledTools(body: unknown) {
  const messages: unknown[] = Array.isArray(body) ? body : [body]

  return messages.flatMap(message => {
    const { method, params } = (message ?? {}) as { method?: unknown; params?: { name?: unknown } }

    return method === 'tools/call' && typeof params?.name === 'string' ? [params.name] : []
  })
}

/*
  An address's endpoint, after its body is read: a call to a tool of a module the address serves
  whose read the token does not hold answers 403, `insufficient_scope`, naming the scopes the
  connection holds with that module's read (`toModuleScopeChallenge`), as a write's challenge does.
  A connection lists only the modules it holds, and the SDK answers a call to a tool it does not
  list with a protocol error, which the modules never answer, and challenges only the tools it
  lists. A stateless server sends no `list_changed`, so this is how a client that listed a module
  before a consent took it away, or that asks for one by name, learns to ask the member. A name no
  module of the address has is left to the SDK. Strategy Dance's agent holds every scope
*/
function createUnheldModuleChallengeMiddleware(address: ModuleAddress, resourceMetadataUrl: string) {
  return async (request: Request, response: Response, next: NextFunction) => {
    const access = readModuleAccess(request.auth)

    if (access.kind !== 'external') return next()

    const unheld = new Map<string, ModuleScope>()

    for (const tool of readCalledTools(request.body)) {
      const name = findToolModule(tool)
      const module = name && address.modules.includes(name) ? MODULES.find(each => each.name === name) : undefined

      if (module && !access.scopes.includes(module.scopes.read)) unheld.set(tool, module.scopes.read)
    }

    const [first, ...rest] = [...new Set(unheld.values())]

    if (!first) return next()

    const challenge = toModuleScopeChallenge(
      access,
      [first, ...rest],
      `Calling ${[...unheld.keys()].join(', ')} needs ${[first, ...rest].join(', ')}`,
    )
    const answer = bearerAuthChallengeResponse(
      new OAuthError(OAuthErrorCode.InsufficientScope, challenge.errorDescription ?? 'Insufficient scope'),
      { requiredScopes: [...challenge.scopes], resourceMetadataUrl },
    )

    response.status(answer.status)
    answer.headers.forEach((value, header) => response.setHeader(header, value))
    response.send(await answer.text())
  }
}

export default createUnheldModuleChallengeMiddleware
