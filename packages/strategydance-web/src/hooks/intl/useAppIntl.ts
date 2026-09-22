import { use } from 'react'

import IntlContext from '~contexts/IntlContext'

// Named useAppIntl rather than useIntl, which is react-intl's own hook for formatting a message
function useAppIntl() {
  return use(IntlContext)
}

export default useAppIntl
