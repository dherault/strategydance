The Strategy Dance mark, drawn in the text color. Use it where Strategy Dance itself speaks: a
sign-in screen, a not found page, a header's lockup, the agent's face. A company's own logo is
`CompanyLogo`, and a member's face is `Avatar`.

## Usage

```jsx
const { Logo } = window.StrategyDanceDesignSystem

<div className="flex items-center gap-6">
  <Logo title="Strategy Dance" className="w-16 text-secondary" />
  <Logo title="Strategy Dance" className="w-16 text-black" />
  <div className="grid size-24 place-items-center rounded-xs bg-primary">
    <Logo title="Strategy Dance" className="w-12 text-white" />
  </div>
</div>
```

The lockup: the mark about one and a half times the name's cap height, half its own height away.
The name already says it, so the mark goes without a `title`:

```jsx
const { Logo } = window.StrategyDanceDesignSystem

<div className="flex items-center gap-3 text-secondary">
  <Logo className="h-6 w-auto" />
  <span className="font-sans text-xl font-bold tracking-[-0.02em]">Strategy Dance</span>
</div>
```

## Notes

- Always size it with a width class (`w-12`, `w-20`) or a height and `w-auto` (`h-6 w-auto`). Its
  box is cropped to the mark, so the other side follows
- Its fill is `currentColor`: set the color with a text class on it or its parent. Navy
  (`text-secondary`) or black on a light surface, white on primary, and never another color
- `title` names it for assistive technology, as an image. Without one it is decorative and hidden,
  which is right beside the words "Strategy Dance"
- It takes no `size` and no `variant`, and has no wordmark of its own: write the name beside it
