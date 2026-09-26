import { use } from 'react'

import SidebarContext from 'strategydance-design-system/contexts/SidebarContext'

function useSidebar() {
  return use(SidebarContext)
}

export default useSidebar
