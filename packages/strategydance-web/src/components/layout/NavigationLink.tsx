import { Link, type LinkProps, useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem } from 'strategydance-design-system/components/ui/Sidebar'
import useSidebar from 'strategydance-design-system/hooks/useSidebar'

type Props = {
  // Matched against the current path to mark the row active
  path: string
  // Active on the pages under the path too, as the knowledge's row is on each document's
  isNested?: boolean
  label: string
  icon: ReactNode
  link: LinkProps
  /*
    A count at the end of the row, such as the conversations waiting for an answer, and what it
    counts in words. The pill is for the eye; the words are read with the link's name, since the
    pill sits outside the link
  */
  badge?: { count: number; label: string }
}

// A row of the sidebar's navigation
function NavigationLink({ path, isNested = false, label, icon, link, badge }: Props) {
  const { isMobile, setOpenMobile } = useSidebar()
  const pathname = useRouterState({ select: state => state.location.pathname })
  const isActive = pathname === path || (isNested && pathname.startsWith(`${path}/`))

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
      >
        <Link
          {...link}
          // On a narrow screen the sidebar is a panel over the page, which should get out of the way
          onClick={() => {
            if (isMobile) setOpenMobile(false)
          }}
        >
          {icon}
          {/* The button truncates its last span, so the words for the badge go inside it */}
          <span>
            {label}
            {badge ? <span className="sr-only">, {badge.label}</span> : null}
          </span>
        </Link>
      </SidebarMenuButton>
      {badge ? <SidebarMenuBadge aria-hidden>{badge.count}</SidebarMenuBadge> : null}
    </SidebarMenuItem>
  )
}

export default NavigationLink
