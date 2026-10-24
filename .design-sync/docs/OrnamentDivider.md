The rule under the title of a full screen beat, such as a chapter's opening or the onboarding's
prologue: two blades tapering in from nothing towards a dot, in the text color. It is a flourish
for a ceremonial moment; a plain divider between sections or menu items is `Separator`.

## Usage

```jsx
const { OrnamentDivider } = window.StrategyDanceDesignSystem

<div className="flex flex-col items-center gap-6 bg-primary p-12 text-center text-white">
  <p className="m-0 text-3xl font-medium tracking-wider uppercase">Chapter 1</p>
  <OrnamentDivider />
  <h1 className="m-0 text-7xl leading-none text-white">Strategy</h1>
</div>
```

On a light surface it takes a text color of its own:

```jsx
const { OrnamentDivider } = window.StrategyDanceDesignSystem

<div className="flex flex-col items-center gap-6 p-12 text-center">
  <h1 className="m-0 text-5xl">Welcome to Strategy Dance</h1>
  <OrnamentDivider className="text-primary" />
  <p className="m-0 max-w-md text-lg text-muted-foreground">Let's find out where your company stands.</p>
</div>
```

## Notes

- 320px wide and 12px tall, never wider than its container, and a block: center it in a column
  with `items-center`, as above. A width class (`w-48`) makes it shorter
- Its color is `currentColor`, so it follows the text color around it: white on primary, where it
  is used, or `text-primary` and `text-secondary` on a light surface
- Decorative, so hidden from assistive technology: it needs no label
- Several on one page each keep their own gradients
