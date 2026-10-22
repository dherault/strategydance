The icon of one of the nine aspects of a company, the areas Strategy Dance guides a team through:
strategy, marketing, sales, product, engineering, design, people and operations, finances and
legal. Use it wherever an aspect is named, in a sidebar row, a task card or a knowledge document's
tags, rather than picking a Lucide icon by hand. `CompanyAspects`, on the global, lists the aspects
in their order, each `{ id, label, lucide }`.

## Usage

```jsx
const { CompanyAspectIcon, CompanyAspects } = window.StrategyDanceDesignSystem

<ul className="m-0 flex max-w-sm list-none flex-col gap-2 p-0">
  {CompanyAspects.map(aspect => (
    <li key={aspect.id} className="flex items-center gap-3 text-sm text-foreground">
      <CompanyAspectIcon aspect={aspect.id} className="text-secondary" />
      {aspect.label}
    </li>
  ))}
</ul>
```

In a tile, as an aspect's card opens, and as a task card's row of small aspects, which names them
once for the whole row:

```jsx
const { CompanyAspectIcon } = window.StrategyDanceDesignSystem

<div className="flex items-center gap-6">
  <span className="grid size-10 place-items-center rounded-xs bg-primary-50 text-primary">
    <CompanyAspectIcon aspect="marketing" size={20} />
  </span>
  <span role="img" aria-label="Aspects: Product, Engineering" className="flex items-center gap-1 text-neutral-500">
    <CompanyAspectIcon aspect="product" size={14} />
    <CompanyAspectIcon aspect="engineering" size={14} />
  </span>
  <CompanyAspectIcon aspect="finances" size={32} title="Finances" className="text-primary" />
</div>
```

## Notes

- `aspect` takes the lowercase id: `strategy`, `marketing`, `sales`, `product`, `engineering`,
  `design`, `people`, `finances` or `legal`. `people` is the one labelled "People and operations"
- `size` is in pixels, 16 unless set. It draws in the text color, so a text class on it or its
  parent colors it
- Decorative unless `title` names it. Beside the aspect's name it needs none; standing alone, give
  it a `title`, or name a group of them once, as the row above does
