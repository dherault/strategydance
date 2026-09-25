import { type VariantProps, cva } from 'class-variance-authority'
import { PanelLeftIcon, XIcon } from 'lucide-react'
import { Slot } from 'radix-ui'
import {
  type CSSProperties,
  type ComponentProps,
  type ReactNode,
  useEffect,
  useEffectEvent,
  useState,
} from 'react'

import { cn } from 'strategydance-design-system/lib/utils'

import SidebarContext, { type SidebarContextType } from 'strategydance-design-system/contexts/SidebarContext'
import useIsMobile from 'strategydance-design-system/hooks/useIsMobile'
import useSidebar from 'strategydance-design-system/hooks/useSidebar'

import { Button } from 'strategydance-design-system/components/ui/Button'
import { Input } from 'strategydance-design-system/components/ui/Input'
import { Separator } from 'strategydance-design-system/components/ui/Separator'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from 'strategydance-design-system/components/ui/Sheet'
import { Skeleton } from 'strategydance-design-system/components/ui/Skeleton'
import { Tooltip } from 'strategydance-design-system/components/ui/Tooltip'

/*
  shadcn's sidebar, on the design's: a 256px neutral-50 column with no border, rows 32px tall that
  hover in neutral-200, the active one in primary-50 with primary text, and the xs radius
  throughout. The design's menus are the design system's DropdownMenu, and what goes in the
  sidebar is the app's to compose
*/

const SIDEBAR_WIDTH = '16rem'
const SIDEBAR_WIDTH_MOBILE = '18rem'
const SIDEBAR_WIDTH_ICON = '3rem'
const SIDEBAR_KEYBOARD_SHORTCUT = 'b'

const focusClassName = 'outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sidebar-ring'

type SidebarProviderProps = ComponentProps<'div'> & {
  defaultOpen?: boolean
  // Controlled when given, which is how the app keeps the state across visits
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  className,
  style,
  children,
  ...props
}: SidebarProviderProps) {
  const isMobile = useIsMobile()
  const [openMobile, setOpenMobile] = useState(false)
  const [openState, setOpenState] = useState(defaultOpen)

  const open = openProp ?? openState

  function setOpen(value: boolean | ((open: boolean) => boolean)) {
    const nextOpen = typeof value === 'function' ? value(open) : value

    if (openProp === undefined) setOpenState(nextOpen)

    onOpenChange?.(nextOpen)
  }

  function toggleSidebar() {
    if (isMobile) setOpenMobile(current => !current)
    else setOpen(current => !current)
  }

  // Cmd+B or Ctrl+B toggles it, from anywhere on the page
  const handleShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== SIDEBAR_KEYBOARD_SHORTCUT || !(event.metaKey || event.ctrlKey)) return

    event.preventDefault()
    toggleSidebar()
  })

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => handleShortcut(event)

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const contextValue: SidebarContextType = {
    state: open ? 'expanded' : 'collapsed',
    open,
    setOpen,
    openMobile,
    setOpenMobile,
    isMobile,
    toggleSidebar,
  }

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        data-slot="sidebar-wrapper"
        style={{
          '--sidebar-width': SIDEBAR_WIDTH,
          '--sidebar-width-icon': SIDEBAR_WIDTH_ICON,
          ...style,
        } as CSSProperties}
        className={cn('group/sidebar-wrapper flex min-h-svh w-full font-sans has-data-[variant=inset]:bg-sidebar', className)}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  )
}

type SidebarProps = ComponentProps<'div'> & {
  side?: 'left' | 'right'
  variant?: 'sidebar' | 'floating' | 'inset'
  collapsible?: 'offcanvas' | 'icon' | 'none'
  // Names the sheet the sidebar becomes below `md`, which assistive technology sees as a dialog
  label?: string
  // Names the button closing that sheet
  closeLabel?: string
}

function Sidebar({
  side = 'left',
  variant = 'sidebar',
  collapsible = 'offcanvas',
  label = 'Sidebar',
  closeLabel = 'Close the sidebar',
  dir,
  className,
  style,
  children,
  ...props
}: SidebarProps) {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar()

  if (collapsible === 'none') {
    return (
      <div
        data-slot="sidebar"
        className={cn('flex h-full w-(--sidebar-width) flex-col bg-sidebar text-sidebar-foreground', className)}
        style={style}
        {...props}
      >
        {children}
      </div>
    )
  }

  if (isMobile) {
    return (
      <Sheet
        open={openMobile}
        onOpenChange={setOpenMobile}
      >
        <SheetContent
          dir={dir}
          data-sidebar="sidebar"
          data-slot="sidebar"
          data-mobile="true"
          side={side}
          showCloseButton={false}
          aria-describedby={undefined}
          // The caller's props reach the sheet as they reach the column on a wide screen, so the
          // sidebar keeps its classes, attributes and handlers across the breakpoint
          className={cn('w-(--sidebar-width) gap-0 border-0 bg-sidebar p-0 text-sidebar-foreground', className)}
          style={{ '--sidebar-width': SIDEBAR_WIDTH_MOBILE, ...style } as CSSProperties}
          {...props}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>
              {label}
            </SheetTitle>
          </SheetHeader>
          {/*
            The sheet is modal, so whatever opened it is out of reach until it closes, and this is
            the way to close it besides Escape and the backdrop. Hidden until the keyboard focuses
            it, since shown it would sit on the sidebar's first row. First in the sheet, so opening
            it from the keyboard lands on it
          */}
          <SheetClose asChild>
            <Button
              variant="transparent"
              size="sm"
              icon={<XIcon />}
              aria-label={closeLabel}
              className="absolute top-2 right-2 z-20 bg-sidebar not-focus-visible:sr-only"
            />
          </SheetClose>
          <div className="flex size-full flex-col">
            {children}
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <div
      data-slot="sidebar"
      data-state={state}
      data-collapsible={state === 'collapsed' ? collapsible : ''}
      data-variant={variant}
      data-side={side}
      className="group peer hidden text-sidebar-foreground md:block"
    >
      {/* Holds the sidebar's place in the layout, since the sidebar itself is fixed */}
      <div
        data-slot="sidebar-gap"
        className={cn(
          'relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear',
          'group-data-[collapsible=offcanvas]:w-0 group-data-[side=right]:rotate-180',
          variant === 'floating' || variant === 'inset'
            ? 'group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]'
            : 'group-data-[collapsible=icon]:w-(--sidebar-width-icon)',
        )}
      />
      <div
        data-slot="sidebar-container"
        data-side={side}
        className={cn(
          'fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear data-[side=left]:left-0 data-[side=left]:group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)] data-[side=right]:right-0 data-[side=right]:group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)] md:flex',
          variant === 'floating' || variant === 'inset'
            ? 'p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]'
            : 'group-data-[collapsible=icon]:w-(--sidebar-width-icon)',
          className,
        )}
        style={style}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          data-slot="sidebar-inner"
          className="flex size-full flex-col bg-sidebar group-data-[variant=floating]:rounded-xs group-data-[variant=floating]:shadow-sm group-data-[variant=floating]:ring-1 group-data-[variant=floating]:ring-sidebar-border"
        >
          {children}
        </div>
      </div>
    </div>
  )
}

type SidebarTriggerProps = Omit<ComponentProps<typeof Button>, 'icon' | 'children'> & {
  label?: string
}

function SidebarTrigger({ label = 'Toggle sidebar', onClick, ...props }: SidebarTriggerProps) {
  const { toggleSidebar } = useSidebar()

  return (
    <Button
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      variant="transparent"
      size="sm"
      icon={<PanelLeftIcon />}
      aria-label={label}
      onClick={event => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    />
  )
}

// The thin strip along the sidebar's edge that toggles it on click
function SidebarRail({ label = 'Toggle sidebar', className, ...props }: ComponentProps<'button'> & { label?: string }) {
  const { toggleSidebar } = useSidebar()

  return (
    <button
      type="button"
      data-sidebar="rail"
      data-slot="sidebar-rail"
      aria-label={label}
      title={label}
      tabIndex={-1}
      onClick={toggleSidebar}
      className={cn(
        'absolute inset-y-0 z-20 hidden w-4 transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:start-1/2 after:w-[2px] hover:after:bg-sidebar-border sm:flex ltr:-translate-x-1/2 rtl:-translate-x-1/2',
        'in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize',
        '[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize',
        'group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full hover:group-data-[collapsible=offcanvas]:bg-sidebar',
        '[[data-side=left][data-collapsible=offcanvas]_&]:-right-2 [[data-side=right][data-collapsible=offcanvas]_&]:-left-2',
        className,
      )}
      {...props}
    />
  )
}

// The page beside the sidebar
function SidebarInset({ className, ...props }: ComponentProps<'main'>) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn(
        'relative flex w-full min-w-0 flex-1 flex-col bg-background md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xs md:peer-data-[variant=inset]:shadow-sm md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2',
        className,
      )}
      {...props}
    />
  )
}

function SidebarInput({ className, ...props }: ComponentProps<typeof Input>) {
  return (
    <Input
      data-slot="sidebar-input"
      data-sidebar="input"
      className={cn('h-8 bg-white', className)}
      {...props}
    />
  )
}

function SidebarHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-header"
      data-sidebar="header"
      className={cn('relative flex flex-col gap-2 p-2', className)}
      {...props}
    />
  )
}

function SidebarFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-footer"
      data-sidebar="footer"
      className={cn('relative flex flex-col gap-2 p-2', className)}
      {...props}
    />
  )
}

function SidebarSeparator({ className, ...props }: ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="sidebar-separator"
      data-sidebar="separator"
      className={cn('mx-2 w-auto bg-sidebar-border', className)}
      {...props}
    />
  )
}

// Scrolls, with its groups 16px apart
function SidebarContent({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-content"
      data-sidebar="content"
      className={cn('flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-2 group-data-[collapsible=icon]:overflow-hidden', className)}
      {...props}
    />
  )
}

function SidebarGroup({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-group"
      data-sidebar="group"
      className={cn('relative flex w-full min-w-0 flex-col gap-0.5', className)}
      {...props}
    />
  )
}

function SidebarGroupLabel({ asChild = false, className, ...props }: ComponentProps<'div'> & { asChild?: boolean }) {
  const Component = asChild ? Slot.Root : 'div'

  return (
    <Component
      data-slot="sidebar-group-label"
      data-sidebar="group-label"
      className={cn(
        'flex h-7 shrink-0 items-center rounded-xs px-2 text-xs font-medium text-muted-foreground transition-[margin,opacity] duration-200 ease-linear group-data-[collapsible=icon]:-mt-7 group-data-[collapsible=icon]:opacity-0 [&>svg]:size-4 [&>svg]:shrink-0',
        focusClassName,
        className,
      )}
      {...props}
    />
  )
}

function SidebarGroupAction({ asChild = false, className, ...props }: ComponentProps<'button'> & { asChild?: boolean }) {
  const Component = asChild ? Slot.Root : 'button'

  return (
    <Component
      data-slot="sidebar-group-action"
      data-sidebar="group-action"
      className={cn(
        'absolute top-1 right-1 flex aspect-square w-5 cursor-pointer items-center justify-center rounded-xs p-0 text-muted-foreground transition-colors group-data-[collapsible=icon]:hidden after:absolute after:-inset-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:after:hidden [&>svg]:size-4 [&>svg]:shrink-0',
        focusClassName,
        className,
      )}
      {...props}
    />
  )
}

function SidebarGroupContent({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-group-content"
      data-sidebar="group-content"
      className={cn('w-full text-sm', className)}
      {...props}
    />
  )
}

function SidebarMenu({ className, ...props }: ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="sidebar-menu"
      data-sidebar="menu"
      className={cn('m-0 flex w-full min-w-0 list-none flex-col gap-0.5 p-0', className)}
      {...props}
    />
  )
}

function SidebarMenuItem({ className, ...props }: ComponentProps<'li'>) {
  return (
    <li
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className={cn('group/menu-item relative', className)}
      {...props}
    />
  )
}

/*
  The row. An open menu's trigger keeps the hover colour while its menu is up, and the active row
  holds primary-50 even under the pointer, which is why it is `data-[active=true]` rather than
  shadcn's `data-active`: that one wraps its selector in `:where()`, so any `:hover` outranks it.
  Icons are muted, and primary on the active row
*/
const sidebarMenuButtonVariants = cva(
  `peer/menu-button group/menu-button flex w-full cursor-pointer items-center gap-2 overflow-hidden rounded-xs p-2 text-left text-sm text-sidebar-foreground no-underline transition-[width,height,padding,background-color,color] duration-150 ease-in-out ${focusClassName} group-has-data-[sidebar=menu-action]/menu-item:pr-8 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! hover:bg-sidebar-accent hover:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground data-[active=true]:bg-primary-50 data-[active=true]:font-medium data-[active=true]:text-primary [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground data-[active=true]:[&_svg]:text-primary [&>span:last-child]:truncate`,
  {
    variants: {
      variant: {
        default: '',
        outline: 'bg-white shadow-[0_0_0_1px_var(--sidebar-border)] hover:shadow-[0_0_0_1px_var(--sidebar-accent)]',
      },
      size: {
        default: 'h-8 text-sm',
        sm: 'h-7 text-xs',
        lg: 'h-12 text-sm group-data-[collapsible=icon]:p-0!',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

type SidebarMenuButtonProps = ComponentProps<'button'> & VariantProps<typeof sidebarMenuButtonVariants> & {
  asChild?: boolean
  isActive?: boolean
  // Shown beside the row while the sidebar is collapsed to its icons
  tooltip?: ReactNode
}

function SidebarMenuButton({
  asChild = false,
  isActive = false,
  variant = 'default',
  size = 'default',
  tooltip,
  className,
  ...props
}: SidebarMenuButtonProps) {
  const { isMobile, state } = useSidebar()

  const Component = asChild ? Slot.Root : 'button'

  const button = (
    <Component
      data-slot="sidebar-menu-button"
      data-sidebar="menu-button"
      data-size={size}
      data-active={isActive}
      className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
      {...props}
    />
  )

  if (!tooltip) return button

  return (
    <Tooltip
      content={tooltip}
      side="right"
      disabled={state !== 'collapsed' || isMobile}
    >
      {button}
    </Tooltip>
  )
}

function SidebarMenuAction({
  asChild = false,
  showOnHover = false,
  className,
  ...props
}: ComponentProps<'button'> & { asChild?: boolean, showOnHover?: boolean }) {
  const Component = asChild ? Slot.Root : 'button'

  return (
    <Component
      data-slot="sidebar-menu-action"
      data-sidebar="menu-action"
      className={cn(
        'absolute top-1.5 right-1 flex aspect-square w-5 cursor-pointer items-center justify-center rounded-xs p-0 text-muted-foreground transition-colors group-data-[collapsible=icon]:hidden peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[size=default]/menu-button:top-1.5 peer-data-[size=lg]/menu-button:top-3.5 peer-data-[size=sm]/menu-button:top-1 after:absolute after:-inset-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:after:hidden [&>svg]:size-4 [&>svg]:shrink-0',
        focusClassName,
        showOnHover && 'group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 peer-data-[active=true]/menu-button:text-primary aria-expanded:opacity-100 md:opacity-0',
        className,
      )}
      {...props}
    />
  )
}

// A count at the end of a row: a neutral-200 pill, as the design has it
function SidebarMenuBadge({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-menu-badge"
      data-sidebar="menu-badge"
      className={cn(
        'pointer-events-none absolute top-1.5 right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-200 px-1.5 text-xs font-medium text-muted-foreground tabular-nums select-none group-data-[collapsible=icon]:hidden peer-data-[size=lg]/menu-button:top-3.5 peer-data-[size=sm]/menu-button:top-1',
        className,
      )}
      {...props}
    />
  )
}

// A row's shape while its label loads. shadcn picks the width at random; here it is a prop
function SidebarMenuSkeleton({
  showIcon = false,
  width = '70%',
  className,
  ...props
}: ComponentProps<'div'> & { showIcon?: boolean, width?: string }) {
  return (
    <div
      data-slot="sidebar-menu-skeleton"
      data-sidebar="menu-skeleton"
      className={cn('flex h-8 items-center gap-2 rounded-xs px-2', className)}
      {...props}
    >
      {showIcon
        ? (
            <Skeleton
              data-sidebar="menu-skeleton-icon"
              className="size-4"
            />
          )
        : null}
      <Skeleton
        data-sidebar="menu-skeleton-text"
        className="h-4 max-w-(--skeleton-width) flex-1"
        style={{ '--skeleton-width': width } as CSSProperties}
      />
    </div>
  )
}

function SidebarMenuSub({ className, ...props }: ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="sidebar-menu-sub"
      data-sidebar="menu-sub"
      className={cn('mx-3.5 my-0 flex min-w-0 translate-x-px list-none flex-col gap-0.5 border-l border-sidebar-border px-2.5 py-0.5 group-data-[collapsible=icon]:hidden', className)}
      {...props}
    />
  )
}

function SidebarMenuSubItem({ className, ...props }: ComponentProps<'li'>) {
  return (
    <li
      data-slot="sidebar-menu-sub-item"
      data-sidebar="menu-sub-item"
      className={cn('group/menu-sub-item relative', className)}
      {...props}
    />
  )
}

function SidebarMenuSubButton({
  asChild = false,
  size = 'md',
  isActive = false,
  className,
  ...props
}: ComponentProps<'a'> & { asChild?: boolean, size?: 'sm' | 'md', isActive?: boolean }) {
  const Component = asChild ? Slot.Root : 'a'

  return (
    <Component
      data-slot="sidebar-menu-sub-button"
      data-sidebar="menu-sub-button"
      data-size={size}
      data-active={isActive}
      className={cn(
        'flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-xs px-2 text-sidebar-foreground no-underline group-data-[collapsible=icon]:hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[size=md]:text-sm data-[size=sm]:text-xs data-[active=true]:bg-primary-50 data-[active=true]:font-medium data-[active=true]:text-primary [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground',
        focusClassName,
        className,
      )}
      {...props}
    />
  )
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  sidebarMenuButtonVariants,
}
