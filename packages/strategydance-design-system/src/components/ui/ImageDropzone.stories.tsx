import type { Meta, StoryObj } from '@storybook/react-vite'
import { type ComponentProps, useState } from 'react'

import { ImageDropzone } from 'strategydance-design-system/components/ui/ImageDropzone'

// Stand-ins for an uploaded banner, logo and photo, drawn inline so the stories need no asset. The
// photo is wider than tall, so the circle shows how it is cropped
const BANNER = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="600"><defs><linearGradient id="g" x2="1"><stop offset="0" stop-color="#0051a3"/><stop offset="1" stop-color="#142a41"/></linearGradient></defs><rect width="2400" height="600" fill="url(#g)"/></svg>')}`
const LOGO = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><circle cx="128" cy="128" r="96" fill="#0051a3"/></svg>')}`
const PHOTO = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320"><rect width="480" height="320" fill="#d6e4f5"/><circle cx="240" cy="130" r="64" fill="#142a41"/><ellipse cx="240" cy="330" rx="120" ry="100" fill="#142a41"/></svg>')}`

// Previews whatever is chosen, as the settings page does with an object URL
function ImageDropzoneDemo({ src: initialSrc, ...props }: ComponentProps<typeof ImageDropzone>) {
  const [src, setSrc] = useState(initialSrc)

  return (
    <ImageDropzone
      {...props}
      src={src}
      onFileSelect={file => setSrc(URL.createObjectURL(file))}
    />
  )
}

const meta = {
  title: 'Components/ImageDropzone',
  component: ImageDropzone,
  args: {
    label: 'Choose a banner',
    onFileSelect: () => {},
  },
  parameters: {
    layout: 'padded',
  },
  render: args => (
    <div className="max-w-[512px]">
      <ImageDropzoneDemo {...args} />
    </div>
  ),
} satisfies Meta<typeof ImageDropzone>

export default meta

type Story = StoryObj<typeof meta>

export const Wide: Story = {}

export const WidePreview: Story = {
  args: {
    src: BANNER,
    alt: 'Banner preview',
  },
}

export const Square: Story = {
  args: {
    shape: 'square',
    label: 'Choose a logo',
  },
}

export const SquarePreview: Story = {
  args: {
    shape: 'square',
    label: 'Choose a logo',
    src: LOGO,
    alt: 'Logo preview',
  },
}

export const Circle: Story = {
  args: {
    shape: 'circle',
    label: 'Choose a profile picture',
  },
}

export const CirclePreview: Story = {
  args: {
    shape: 'circle',
    label: 'Choose a profile picture',
    src: PHOTO,
    alt: 'Profile picture preview',
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
  },
}
