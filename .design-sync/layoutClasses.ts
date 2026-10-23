/*
  The Tailwind classes the design agent may write for its own layout, beyond those the design
  system's sources and stories use. The upload's stylesheet holds only classes something compiled,
  so a class nothing uses has no rule there and fails silently: `buildPackage.ts` compiles every
  candidate below into the sync's stylesheet alone, through `@source inline()`, and
  `checkNames.ts` proves each one compiled, since Tailwind drops a candidate it does not know
  without a word. `conventions.md` states the list in words: change both together.

  Each entry is a Tailwind brace pattern: `{a,b}` for alternatives, `{1..12}` for a range, and an
  empty alternative for none, as in `{,md:}`.
*/
const RESPONSIVE = '{,sm:,md:,lg:}'
const SPACES = '{0,0.5,1,1.5,2,2.5,3,4,5,6,8,10,12,16,20,24}'
const SIZES = '{px,0.5,1,1.5,2,2.5,3,3.5,4,5,6,8,10,12,16,20,24,32,40,48,56,64,72,80,96}'
const SHADES = '{50,100,200,300,400,500,600,700,800,900,950}'

// The design system's own colour tokens, `index.css`'s `@theme inline`, and Tailwind's plainest
const ROLES =
  '{background,foreground,card,card-foreground,popover,popover-foreground,primary,primary-foreground,secondary,secondary-foreground,muted,muted-foreground,accent,accent-foreground,destructive,border,input,ring,success,success-bg,warning,warning-bg,danger,danger-bg,white,black,transparent}'

const LAYOUT_CLASSES = [
  // Display and flow
  `${RESPONSIVE}{block,inline-block,inline,flex,inline-flex,grid,hidden,contents}`,
  `${RESPONSIVE}flex-{row,col,row-reverse,col-reverse,wrap,nowrap,1,auto,none}`,
  '{grow,grow-0,shrink,shrink-0}',
  `${RESPONSIVE}items-{start,center,end,baseline,stretch}`,
  `${RESPONSIVE}justify-{start,center,end,between,around,evenly}`,
  'self-{auto,start,center,end,stretch}',
  'place-{items,content}-center',
  `${RESPONSIVE}grid-cols-{1..12}`,
  `${RESPONSIVE}col-span-{1..12}`,
  'col-span-full',
  'grid-rows-{1..6}',
  'row-span-{1..6}',
  `${RESPONSIVE}order-{first,last,none}`,

  // Spacing
  `${RESPONSIVE}{p,px,py,pt,pr,pb,pl,m,mx,my,mt,mr,mb,ml,gap,gap-x,gap-y}-${SPACES}`,
  '{m,mx,my,mt,mr,mb,ml}-auto',
  'space-{x,y}-{1,2,3,4,6,8}',

  // Sizing
  'w-{0,full,auto,fit,screen,1/2,1/3,2/3,1/4,3/4}',
  `w-${SIZES}`,
  'h-{0,full,auto,fit,screen,svh}',
  `h-${SIZES}`,
  'size-{1,1.5,2,2.5,3,3.5,4,5,6,8,10,12,16,20,24,32}',
  'min-w-0',
  'min-h-{0,full,screen,svh}',
  `${RESPONSIVE}max-w-{xs,sm,md,lg,xl,2xl,3xl,4xl,5xl,6xl,7xl,full,prose,none}`,
  'max-h-{full,screen,svh}',
  'aspect-{auto,square,video}',

  // Type
  `${RESPONSIVE}text-{xs,sm,base,lg,xl,2xl,3xl,4xl,5xl,6xl}`,
  'font-{sans,display,heading,normal,medium,semibold,bold}',
  'text-{left,center,right}',
  'leading-{none,tight,snug,normal,relaxed}',
  'tracking-{tight,normal,wide}',
  '{uppercase,normal-case,italic,underline,line-through,truncate,whitespace-nowrap,tabular-nums,text-balance,text-pretty}',
  'line-clamp-{1,2,3,4}',

  // Colour
  `{bg,text,border}-${ROLES}`,
  `{bg,text,border}-{primary,secondary,neutral}-${SHADES}`,

  // Borders and depth
  'border',
  'border-{0,2,4}',
  'border-{t,b,l,r,x,y}',
  'border-{dashed,dotted}',
  'rounded-{none,xs,sm,md,lg,xl,2xl,full}',
  'divide-{x,y}',
  'divide-border',
  'shadow-{none,xs,sm,md,lg,xl}',
  'opacity-{0,50,75,100}',

  // Position and overflow
  '{static,relative,absolute,fixed,sticky}',
  '{inset,inset-x,inset-y,top,right,bottom,left}-0',
  'z-{0,10,20,30,40,50}',
  'overflow-{hidden,auto,visible}',
  'overflow-{x,y}-auto',

  // The rest
  '{cursor-pointer,select-none,pointer-events-none,sr-only}',
  'object-{cover,contain}',
]

// Expands one pattern as Tailwind does, so the check can name every class it should find
function expandClassPattern(pattern: string): string[] {
  const group = /\{([^{}]*)\}/.exec(pattern)

  if (!group) return [pattern]

  const range = /^(\d+)\.\.(\d+)$/.exec(group[1])
  const alternatives = range
    ? Array.from({ length: Number(range[2]) - Number(range[1]) + 1 }, (_, index) => String(Number(range[1]) + index))
    : group[1].split(',')
  const before = pattern.slice(0, group.index)
  const after = pattern.slice(group.index + group[0].length)

  return alternatives.flatMap(alternative => expandClassPattern(`${before}${alternative}${after}`))
}

export { LAYOUT_CLASSES, expandClassPattern }
