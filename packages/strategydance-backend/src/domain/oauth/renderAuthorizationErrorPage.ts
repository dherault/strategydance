import { escapeUTF8 } from 'entities'

/*
  The page an authorization answers with when it cannot send the browser back to its client, since
  the client or its redirect address is not known good, so nobody can bounce a browser through the
  server: what went wrong, escaped, in plain HTML, which the server's `default-src 'none'` policy
  lets through as it is
*/
function renderAuthorizationErrorPage(message: string) {
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Strategy Dance</title></head>',
    '<body>',
    '<h1>This authorization cannot go on</h1>',
    `<p>${escapeUTF8(message)}</p>`,
    '<p>Go back to the app that sent you here, and try connecting it again.</p>',
    '</body>',
    '</html>',
  ].join('\n')
}

export default renderAuthorizationErrorPage
