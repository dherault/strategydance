The app's frame: a 256px column of navigation along the left of the screen, the page beside it,
and a sheet over the page below 768px. It is composed from parts inside `SidebarProvider`: the
`Sidebar` column, and the page in `SidebarInset`. A menu opened from a button is `DropdownMenu`,
and a panel sliding over the page is `Sheet`.

## Usage

```jsx
const {
  SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuBadge,
  SidebarInset, SidebarTrigger, CompanyLogo, CompanyAspectIcon, Avatar,
} = window.StrategyDanceDesignSystem
const {
  CalendarIcon, SquareKanbanIcon, FileTextIcon, UsersRoundIcon, ChevronsUpDownIcon,
} = window.StrategyDanceDesignSystem.Icons

const groups = [
  { items: [{ label: 'Today', icon: <CalendarIcon /> }] },
  { label: 'Guidance', items: [
    { label: 'Tasks', icon: <SquareKanbanIcon />, badge: 4 },
    { label: 'Knowledge', icon: <FileTextIcon /> },
  ] },
  { label: 'Company', items: [
    { label: 'Strategy', icon: <CompanyAspectIcon aspect="strategy" /> },
    { label: 'Marketing', icon: <CompanyAspectIcon aspect="marketing" /> },
    { label: 'Team', icon: <UsersRoundIcon /> },
  ] },
]

function AppFrame() {
  const [page, setPage] = React.useState('Today')

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg">
                <CompanyLogo name="Acme Robotics" color="#0051A3" alt="" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm leading-tight font-semibold text-secondary">Acme Robotics</span>
                  <span className="truncate text-xs leading-tight text-muted-foreground">Administrator</span>
                </span>
                <ChevronsUpDownIcon />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          {groups.map(group => (
            <SidebarGroup key={group.label || 'main'}>
              {group.label ? <SidebarGroupLabel>{group.label}</SidebarGroupLabel> : null}
              <SidebarMenu>
                {group.items.map(item => (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton isActive={page === item.label} onClick={() => setPage(item.label)}>
                      {item.icon}
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                    {item.badge ? <SidebarMenuBadge>{item.badge}</SidebarMenuBadge> : null}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg">
                <Avatar name="Alex Martin" />
                <span className="font-semibold text-secondary">Alex Martin</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger />
          <h1 className="m-0 text-xl">{page}</h1>
        </header>
        <p className="m-0 p-6 text-muted-foreground">Three tasks are due this week.</p>
      </SidebarInset>
    </SidebarProvider>
  )
}
```

A link row takes `asChild`; a row's action, a group's action and nested rows sit beside it:

```jsx
const {
  SidebarProvider, Sidebar, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarGroupAction,
  SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuAction, SidebarMenuSub,
  SidebarMenuSubItem, SidebarMenuSubButton, SidebarRail, SidebarInset,
} = window.StrategyDanceDesignSystem
const { FileTextIcon, PlusIcon, EllipsisIcon } = window.StrategyDanceDesignSystem.Icons

<SidebarProvider>
  <Sidebar collapsible="icon">
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Knowledge</SidebarGroupLabel>
        <SidebarGroupAction aria-label="Write a document"><PlusIcon /></SidebarGroupAction>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive tooltip="Launch plan">
              <a href="#launch-plan"><FileTextIcon /><span>Launch plan</span></a>
            </SidebarMenuButton>
            <SidebarMenuAction showOnHover aria-label="More actions"><EllipsisIcon /></SidebarMenuAction>
            <SidebarMenuSub>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton href="#pricing" isActive>Pricing</SidebarMenuSubButton>
              </SidebarMenuSubItem>
            </SidebarMenuSub>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
    </SidebarContent>
    <SidebarRail />
  </Sidebar>
  <SidebarInset className="p-6" />
</SidebarProvider>
```

## Parts

- `SidebarProvider`: the frame around everything. `defaultOpen` (true) starts it expanded or
  collapsed; `open` with `onOpenChange` controls it; `open` alone holds it open on a wide screen, as
  the app does. ⌘B or Ctrl+B toggles it
- `Sidebar`: the column, with its props below. `SidebarInset`: the page beside it, a `<main>`
- `SidebarTrigger`: an icon button toggling the column, named by `label` ("Toggle sidebar"), with
  Button's other props. `SidebarRail`: a strip on the column's edge toggling it, last in `Sidebar`
- `SidebarHeader`, `SidebarContent`, `SidebarFooter`: the column's top, scrolling middle and bottom
- `SidebarGroup`: a section. `SidebarGroupLabel` is its small muted heading, `SidebarGroupAction` a
  20px icon button at its top right, `SidebarGroupContent` a wrapper for what is not a menu
- `SidebarMenu` and `SidebarMenuItem`: the list of rows and one row, `<ul>` and `<li>`
- `SidebarMenuButton`: the row, a button holding an icon, then its label in a `<span>` that
  truncates. `isActive` marks the current page; `size` is `default` (32px), `sm` (28px) or `lg`
  (48px, for a logo and two lines); `variant` `default` or `outline`; `tooltip` shows beside it
  while the column is collapsed to icons; `asChild` makes its one child, a link, the row
- `SidebarMenuAction` (`showOnHover` hides it until the row is hovered) and `SidebarMenuBadge`, a
  count in a pill: after the `SidebarMenuButton`, at the row's end
- `SidebarMenuSkeleton`: a row loading, `showIcon` and its bar's `width` ("70%")
- `SidebarMenuSub`, `SidebarMenuSubItem`, `SidebarMenuSubButton`: rows nested under a row. The sub
  button is an `<a>`, with `href`, `isActive`, `size` (`md` or `sm`) and `asChild`
- `SidebarInput`: a 32px input on white, for a search. `SidebarSeparator`: a hairline
- `sidebarMenuButtonVariants({ size, variant })`: a row's classes, for an element of its own

Minimal: `SidebarProvider` > `Sidebar` > `SidebarContent` > `SidebarGroup` > `SidebarMenu` >
`SidebarMenuItem` > `SidebarMenuButton`, and `SidebarInset` beside `Sidebar`.

## Notes

- Outside `SidebarProvider` the column has no width and nothing toggles it: always wrap the parts.
  It is the screen's frame: put it at a page's root, never in a card, since the column is fixed to
  the screen's edge, its full height
- `defaultOpen`, `open` and `onOpenChange` are `SidebarProvider`'s, never `Sidebar`'s
- Below 768px the column is a sheet, closed until `SidebarTrigger` opens it, so a narrow design
  keeps a bar with the trigger. On a wide screen the trigger slides the column away, or narrows it
  to its icons with `collapsible="icon"`
- A row has no `icon`, `label` or `href` prop: compose its children, and wrap a link with `asChild`
- `SidebarGroupAction` and `SidebarMenuAction` are icon-only and need an `aria-label`
