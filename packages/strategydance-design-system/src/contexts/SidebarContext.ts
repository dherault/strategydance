import { createContext } from 'react'

type SetOpen = (open: boolean | ((open: boolean) => boolean)) => void

/*
  Whether the sidebar is open. It keeps two answers: `open` for the column beside the page, and
  `openMobile` for the sheet that stands in for it below `md`, so shrinking the window neither
  opens nor closes the other
*/
export type SidebarContextType = {
  state: 'expanded' | 'collapsed'
  open: boolean
  setOpen: SetOpen
  openMobile: boolean
  setOpenMobile: SetOpen
  isMobile: boolean
  toggleSidebar: () => void
}

export default createContext<SidebarContextType>({
  state: 'expanded',
  open: true,
  setOpen: () => {},
  openMobile: false,
  setOpenMobile: () => {},
  isMobile: false,
  toggleSidebar: () => {},
})
