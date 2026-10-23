Where a picture is chosen: a dashed zone that opens the file picker on a click, Enter or Space,
takes a file dragged onto it, and previews the picture it is given. Use it in the dialog that
changes a company's banner or logo, or a member's profile picture. It hands over the file and
nothing more: the caller checks it, stores it and passes back the preview.

## Usage

```jsx
const { ImageDropzone } = window.StrategyDanceDesignSystem

function LogoPicker() {
  const [src, setSrc] = React.useState(null)

  return (
    <div className="max-w-md">
      <ImageDropzone
        shape="square"
        label="Choose a logo"
        src={src}
        alt="Logo preview"
        accept="image/png,image/jpeg,image/webp"
        onFileSelect={file => setSrc(URL.createObjectURL(file))}
      />
    </div>
  )
}
```

A banner, a profile picture with its own prompt, and a logo being saved:

```jsx
const { ImageDropzone } = window.StrategyDanceDesignSystem

<div className="flex max-w-lg flex-col gap-6">
  <ImageDropzone label="Choose a banner" onFileSelect={file => console.log('banner', file.name)} />
  <ImageDropzone
    shape="circle"
    label="Choose a profile picture"
    prompt={<><strong>Upload a photo</strong> or drop it here</>}
    onFileSelect={file => console.log('picture', file.name)}
  />
  <ImageDropzone
    shape="square"
    label="Choose a logo"
    busy
    busyLabel="Saving the logo"
    onFileSelect={file => console.log('logo', file.name)}
  />
</div>
```

## Notes

- `shape` is `wide` unless set: 4:1 across its container's full width, as a banner. `square` and
  `circle` are at most 200px and centered, for a logo and a profile picture. The preview is cropped
  to fill the zone, and a square one sits on white
- `label` names the zone for assistive technology and is required, as is `onFileSelect`. The zone
  shows `prompt` under an image icon, "Choose a file or drag it here" unless set, and a `<strong>`
  in it takes the primary color
- `src` is the preview, typically an object URL of the file just chosen; without one the zone shows
  its prompt. It never reads the file itself, so a design passes `src` to show a chosen picture
- `busy` dims the preview under a spinner and ignores clicks and drops while the picture saves;
  `disabled` dims the whole zone and ignores them
- It is not a form input: there is no `value`, `onChange` or `name`
