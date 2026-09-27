/*
  Whether a path is one of the sign-in screens: `/authentication` or a page under it. Compared
  lowercased, because the router matches paths regardless of case, so `/Authentication` renders
  the sign-in screen too
*/
function isAuthenticationPath(pathname: string) {
  const lowercasePathname = pathname.toLowerCase()

  return lowercasePathname === '/authentication' || lowercasePathname.startsWith('/authentication/')
}

export default isAuthenticationPath
