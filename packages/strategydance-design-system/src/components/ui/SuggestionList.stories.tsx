import type { Meta, StoryObj } from '@storybook/react-vite'
import { FileTextIcon } from 'lucide-react'
import { useState } from 'react'
import {
  SuggestionList,
  SuggestionListEmpty,
  SuggestionListItem,
  SuggestionListLabel,
  SuggestionListOptions,
} from 'strategydance-design-system/components/ui/SuggestionList'
import { Textarea } from 'strategydance-design-system/components/ui/Textarea'

const TITLES = [
  'Pricing',
  'Fundraising narrative',
  'Launch plan for the second quarter, with every channel we mean to try and what each should bring',
  'Hiring',
]

const meta = {
  title: 'Components/SuggestionList',
  component: SuggestionList,
  parameters: {
    docs: {
      story: {
        height: '280px',
      },
    },
  },
} satisfies Meta<typeof SuggestionList>

export default meta

type Story = StoryObj<typeof meta>

// Over a field, which keeps the focus while the pointer moves the highlight
function SuggestionListOverField() {
  const [highlightedIndex, setHighlightedIndex] = useState(1)

  return (
    <div className="relative mt-56 w-96">
      <SuggestionList className="absolute inset-x-0 bottom-[calc(100%+4px)]">
        <SuggestionListLabel id="suggestion-list-story-label">Documents</SuggestionListLabel>
        <SuggestionListOptions
          id="suggestion-list-story-options"
          aria-labelledby="suggestion-list-story-label"
        >
          {TITLES.map((title, index) => (
            <SuggestionListItem
              key={title}
              id={`suggestion-list-story-option-${index}`}
              isHighlighted={index === highlightedIndex}
              onPointerMove={() => setHighlightedIndex(index)}
            >
              <FileTextIcon />
              <span className="min-w-0 flex-1 truncate">{title}</span>
            </SuggestionListItem>
          ))}
        </SuggestionListOptions>
      </SuggestionList>
      <Textarea
        rows={1}
        defaultValue="Review @"
        aria-label="Message"
        aria-autocomplete="list"
        aria-controls="suggestion-list-story-options"
        aria-activedescendant={`suggestion-list-story-option-${highlightedIndex}`}
      />
    </div>
  )
}

export const Default: Story = {
  render: () => <SuggestionListOverField />,
}

export const Empty: Story = {
  render: () => (
    <SuggestionList className="w-96">
      <SuggestionListEmpty>No document matches “roadmap”</SuggestionListEmpty>
    </SuggestionList>
  ),
}
