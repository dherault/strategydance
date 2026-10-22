A label above a control and a hint or an error below it, laid out as Input and Select lay
themselves out. Use it around a control that brings no label of its own: an upload button, a
group of buttons, a native date input. Input, PasswordInput, SearchInput, Textarea, Select,
Combobox, MultiSelect and ColorPicker take `label`, `hint` and `error` themselves: never wrap them
in a Field.

## Usage

```jsx
const { Field, Button } = window.StrategyDanceDesignSystem
const { UploadIcon } = window.StrategyDanceDesignSystem.Icons

<div className="flex max-w-sm flex-col gap-6">
  <Field label="Picture" hint="A square image of at least 256 pixels.">
    <Button variant="secondary" size="sm" icon={<UploadIcon />} className="self-start">
      Upload a picture
    </Button>
  </Field>
  <Field label="Logo" error="Use a PNG or a JPEG under 5 MB.">
    <Button variant="secondary" size="sm" icon={<UploadIcon />} className="self-start">
      Upload a logo
    </Button>
  </Field>
</div>
```

Around a native control, `htmlFor` points the label at it and `messageId` names the hint for its
`aria-describedby`:

```jsx
const { Field, inputClassName } = window.StrategyDanceDesignSystem

<Field
  label="Deadline"
  hint="The day the task is due."
  htmlFor="task-deadline"
  messageId="task-deadline-hint"
  className="max-w-xs"
>
  <input id="task-deadline" type="date" aria-describedby="task-deadline-hint" className={inputClassName} />
</Field>
```

## Notes

- Its children stack in a column 6px apart and stretch to its width: give a button `self-start`
  to keep it at its own width
- `error` replaces the hint, in red, and is announced as it appears. It marks no control invalid:
  set `aria-invalid` on the control yourself
- Without `htmlFor` the label points at nothing, which is right for an upload button; around a
  native control, pass the control's id
- Its label is drawn with `fieldLabelClassName`, on the global, which dresses a label drawn
  elsewhere the same, as a radio group's
- `className` sizes the whole field, as `max-w-xs`
