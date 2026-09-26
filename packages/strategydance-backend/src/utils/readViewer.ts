import type { Request } from 'express'

/*
  The caller `authenticationMiddleware` verified. A route reads them through this rather than off
  the request, so a route mounted without that middleware fails loudly instead of acting for
  nobody
*/
function readViewer(request: Request) {
  if (!request.viewer) throw new Error('The route reads a viewer, and no authentication middleware ran before it')

  return request.viewer
}

export default readViewer
