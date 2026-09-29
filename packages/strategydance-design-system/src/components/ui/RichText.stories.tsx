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

// An inline style is dropped, the second paragraph's `<b>` tag is not a node and stays text, and
// the unknown `link` element is unwrapped so its text still reads
export const Untrusted: Story = {
  args: {
    value: JSON.stringify({
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'text',
                format: 0,
                style: 'position: fixed; inset: 0; background: red',
                text: 'Styled to cover the page, drawn plain',
              },
            ],
          },
          {
            type: 'paragraph',
            children: [
              { type: 'text', format: 0, text: '<b onmouseover="alert(1)">Markup</b> is text' },
              {
                type: 'link',
                url: 'javascript:alert(1)',
                children: [{ type: 'text', format: 0, text: ', and a link is its words' }],
              },
            ],
          },
        ],
      },
    }),
  },
}

export const Unreadable: Story = {
  args: {
    value: 'not json',
  },
}
