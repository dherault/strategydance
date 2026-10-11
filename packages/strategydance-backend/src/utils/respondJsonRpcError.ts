import type { Response } from 'express'

/*
  A module endpoint's refusal before its handler answers, in MCP's own JSON-RPC rather than the
  app's envelope, since an MCP client reads nothing else: an error with no request's id, as the
  SDK answers a body it could not take. It never logs, as `respondError` does not
*/
function respondJsonRpcError(response: Response, status: number, code: number, message: string) {
  response.status(status).json({ jsonrpc: '2.0', error: { code, message }, id: null })
}

export default respondJsonRpcError
