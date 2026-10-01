import type { Meta, StoryObj } from '@storybook/react-vite'
import { RichText } from 'strategydance-design-system/components/ui/RichText'
import richTextSample from 'strategydance-design-system/components/ui/RichText.sample'

const meta = {
  title: 'Components/RichText',
  component: RichText,
  args: {
    value: richTextSample,
    className: 'max-w-xl',
  },
} satisfies Meta<typeof RichText>

export default meta

type Story = StoryObj<typeof meta>

export const Post: Story = {}

/*
  Colors, alignment and an inline style are dropped, the second paragraph's `<b>` tag is text, the
  `javascript:` link is its words, and the unknown blocks read as what they hold
*/
export const Untrusted: Story = {
  args: {
    value: JSON.stringify([
      {
        type: 'paragraph',
        props: { textColor: 'red', backgroundColor: 'yellow', textAlignment: 'center' },
        content: [
          {
            type: 'text',
            text: 'Colored and centered, drawn plain',
            styles: { textColor: 'red', backgroundColor: 'yellow' },
            style: 'position: fixed; inset: 0; background: red',
          },
        ],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: '<b onmouseover="alert(1)">Markup</b> is text', styles: {} },
          {
            type: 'link',
            href: 'javascript:alert(1)',
            content: [{ type: 'text', text: ', and a script link is its words', styles: {} }],
          },
        ],
      },
      { type: 'codeBlock', content: [{ type: 'text', text: 'A code block reads as a paragraph', styles: {} }] },
      {
        type: 'image',
        props: { url: 'https://example.com/tracker.png' },
        children: [{ type: 'paragraph', content: 'An image is dropped, and what it held kept' }],
      },
    ]),
  },
}

// What the Lexical editor stored before, which is not drawn
export const Legacy: Story = {
  args: {
    value: JSON.stringify({
      root: {
        type: 'root',
        children: [{ type: 'paragraph', children: [{ type: 'text', format: 0, text: 'Written in Lexical' }] }],
      },
    }),
  },
}

export const Unreadable: Story = {
  args: {
    value: 'not json',
  },
}
