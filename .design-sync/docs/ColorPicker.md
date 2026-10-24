A color field: a trigger dressed as an input, with a swatch and the hex code, that opens a
saturation square, a hue slider and a hex field in a popover. Every change applies as it happens,
so there is nothing to confirm. Use it for a brand color, as an organization's.

## Usage

```jsx
const { ColorPicker } = window.StrategyDanceDesignSystem

function OrganizationColor() {
  const [color, setColor] = React.useState('#0051A3')

  return (
    <div className="flex max-w-sm flex-col gap-4">
      <ColorPicker
        label="Primary color"
        hint="Fills your organization's mark wherever it has no logo."
        value={color}
        onChange={setColor}
      />
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="size-8 rounded-xs" style={{ backgroundColor: color }} />
        {color}
      </div>
    </div>
  )
}

<OrganizationColor />
```

Opening below its trigger, for a field near the top of a page, and shown open:

```jsx
const { ColorPicker } = window.StrategyDanceDesignSystem

function AccentColor() {
  const [color, setColor] = React.useState('#E11D48')

  return (
    <ColorPicker
      label="Accent color"
      value={color}
      onChange={setColor}
      side="bottom"
      defaultOpen
      className="max-w-xs"
    />
  )
}

<AccentColor />
```

## Notes

- Controlled only: `value` and `onChange` are both required. `onChange` receives the hex string,
  never an event, always six uppercase digits after a `#`, as `#0051A3`
- `value` takes `#RRGGBB`, or three digits, and the trigger shows it uppercase
- The popover opens above the trigger unless `side="bottom"`, so leave it room. It portals to the
  body. `defaultOpen` opens it at first; there is no `open` or `onOpenChange`
- Without a label, give it an `aria-label`, or it is read as its hex code alone. `hexLabel` names
  the popover's hex field, "Hex color" unless set
- With `label`, `hint` or `error`, `className` goes to the Field around it; without them, to the
  trigger. `error` turns the trigger's border red and replaces the hint
- `disabled` keeps the popover closed
