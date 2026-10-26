# Strategy Dance's design system: read this first

These are the components the Strategy Dance web app ships, built from its repository, so a design
made of them maps onto the product's code one to one. Build with them before writing markup of your
own, and lay out what sits between them with the classes and tokens below. Each component's
`components/<group>/<Name>/<Name>.prompt.md` says how to use it and lists its props: read it before
using the component.

## Loading

The page needs React 19.3, ReactDOM with it, before anything else: this project's
`_vendor/react.js` is that build, ReactDOM included, as every preview card loads it. Then
`styles.css`, the one stylesheet to link, which brings the fonts and `_ds_bundle.css`, and
`_ds_bundle.js`, as Loading below says. Everything is then on `window.StrategyDanceDesignSystem`:

- the components listed under Components, and the parts the compound ones are made of
  (`DialogContent`, `SidebarMenuButton`, `TableRow`…), which each component's usage note names
- `Icons`, every Lucide icon, by its name with the `Icon` suffix:
  `const { PlusIcon } = window.StrategyDanceDesignSystem.Icons`. A component that takes an icon
  takes one of these
- `Recharts`, the parts of [recharts](https://recharts.github.io) a chart inside a `ChartContainer`
  is built from, as its usage note shows: the area, bar, line, composed and pie charts, their
  series, axes, grid and reference marks, and the hooks that place a mark of the design's own.
  `const { AreaChart, Area, XAxis } = window.StrategyDanceDesignSystem.Recharts`
- `toast`, which raises a toast in the one `<Toaster />` a page mounts
- the classes of a few components, for an element that has to look like one:
  `buttonVariants({ variant: 'outline', size: 'sm' })` makes a link look like a Button, and
  `badgeVariants` and `inputClassName` do the same for theirs
- Yjs's exports (`Doc`, `Map`, `Text`, `Array`…), which the rich text editor runs on. They are no
  components: there is no Text or Heading component, and text is plain HTML (`h1` to `h3`, `p`,
  `span`) styled by the classes below

## The wrap

Nothing wraps a whole design: no theme and no provider. What does need one:

- **Sidebar**: an app's frame is `SidebarProvider` around `Sidebar` and `SidebarInset`, the page
  beside it. The provider sets the sidebar's width, so a Sidebar outside it has none
- **Toasts**: mount `<Toaster />` once, near the page's root, then call `toast('Saved')` from
  anywhere
- **Tooltip** brings its own provider: `<Tooltip content="…">` around its trigger is all it takes
- **Overlays**: Dialog, Sheet, Popover, DropdownMenu and Select draw their popups in the body,
  above the rest of the page, and Combobox and MultiSelect too, or inside the Dialog or the Sheet
  around them. Each works inside a Dialog or a Sheet

## Styling

The components are styled with Tailwind v4 classes, and so is a design: `className` on any element.
The stylesheet holds only the classes compiled into it, so a class from neither list below has no
rule and changes nothing, without a warning.

**The design system's tokens**, as classes:

- surfaces and text: `bg-background`, the neutral-50 page, `bg-card`, white, `bg-muted`,
  `text-foreground`, `text-muted-foreground`, `border-border`
- brand: `bg-primary` with `text-primary-foreground`, the blue of the main action (primary-700),
  and `text-secondary`, navy, for headings and strong text, with `bg-secondary` and `bg-accent`
- status: `text-success`, `bg-success-bg`, `text-warning`, `bg-warning-bg`, `text-danger`,
  `bg-danger-bg`
- palettes: primary, secondary and neutral, from 50 to 950, as `bg-primary-50` or
  `text-neutral-500`
- type: `font-sans`, Inter, the default, and `font-display`, Oswald, the headings' face, the
  weights from `font-normal` to `font-bold`, and the sizes from `text-xs` to `text-6xl`
- corners: `rounded-xs`, the design system's own, up to `rounded-full`

**Layout**: `flex` and `grid` with their alignment, `grid-cols-1` to `grid-cols-12` and the
matching column spans, padding, margin and `gap-*` on 0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8,
10, 12, 16, 20 and 24, `space-y-1` to `space-y-8`, widths and heights from a pixel, `w-px`, to
96, with `w-full` and `h-full`,
`max-w-xs` to `max-w-7xl`, `min-h-svh`, `border` and its sides, `shadow-xs` to `shadow-xl`,
`relative`, `absolute`, `sticky`, `inset-0`, `z-10` to `z-50`, `overflow-auto`, `truncate` and
`line-clamp-2`. The breakpoints `sm:`, `md:` and `lg:` work on display, flex direction and
alignment, grid columns and spans, spacing, maximum widths and text sizes.

Anything else goes in a `style` attribute, with the tokens as custom properties:
`style={{ color: 'var(--color-primary-600)', minHeight: 'calc(100svh - 4rem)' }}`. The Tokens
section further down lists every custom property in the stylesheet, BlockNote's and Tailwind's
internals among them: the design system's are those named here.

The page's own defaults: the body is `bg-background`, in Inter, in `text-foreground`; `h1` to `h3`
are Oswald, regular, navy and tracked tight; a link is primary blue. There is no dark theme.

## Example

```jsx
const { Badge, Button, Card, Input, Switch, Toaster, toast } = window.StrategyDanceDesignSystem
const { SaveIcon } = window.StrategyDanceDesignSystem.Icons

function CompanySettings() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl">Company settings</h1>
        <Badge variant="success">Active</Badge>
      </div>
      <Card title="Profile" description="How the company appears to its team.">
        <div className="flex flex-col gap-4">
          <Input label="Company name" defaultValue="Acme Inc." />
          <Switch label="Daily check-in" hint="A short prompt every morning at 9." defaultChecked />
        </div>
      </Card>
      <div className="flex justify-end gap-3">
        <Button variant="outline">Cancel</Button>
        <Button icon={<SaveIcon />} onClick={() => toast('Settings saved')}>
          Save
        </Button>
      </div>
      <Toaster />
    </main>
  )
}
```
