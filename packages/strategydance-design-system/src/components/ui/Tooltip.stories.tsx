import type { Meta, StoryObj } from '@storybook/react-vite'
import { InfoIcon, LockIcon, LockOpenIcon, SearchIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { Tooltip } from 'strategydance-design-system/components/ui/Tooltip'

const meta = {
  title: 'Components/Tooltip',
  component: Tooltip,
  args: {
    content: 'Search your projects',
    children: (
      <Button
        variant="outline"
        icon={<SearchIcon />}
        aria-label="Search"
      />
    ),
  },
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Tooltip>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Open: Story = {
  args: {
    defaultOpen: true,
  },
}

export const WithShortcut: Story = {
  args: {
    defaultOpen: true,
    shortcut: '⌘K',
  },
}

export const Sides: Story = {
  render: args => (
    <div className="grid grid-cols-2 gap-x-32 gap-y-16 p-12">
      {(['top', 'right', 'bottom', 'left'] as const).map(side => (
        <Tooltip
          key={side}
          {...args}
          side={side}
          content={`On the ${side}`}
          defaultOpen
        >
          <Button variant="outline">{side}</Button>
        </Tooltip>
      ))}
    </div>
  ),
}

export const WithoutArrow: Story = {
  args: {
    defaultOpen: true,
    arrow: false,
  },
}

export const OnText: Story = {
  args: {
    content: 'Monthly recurring revenue',
    children: 'MRR',
  },
}

// A toggle whose tooltip says what it does now: pressing it keeps the tooltip open, in its new words
export const KeptOpenOnPress: Story = {
  render: args => <KeptOpenOnPressExample {...args} />,
}

function KeptOpenOnPressExample(props: Parameters<typeof Tooltip>[0]) {
  const [isLocked, setIsLocked] = useState(false)

  return (
    <Tooltip
      {...props}
      isKeptOpenOnPress
      side="bottom"
      content={isLocked ? 'AI modification prevented. Click to allow.' : 'Prevent AI modification'}
    >
      <Button
        variant="transparent"
        size="sm"
        icon={isLocked ? <LockIcon /> : <LockOpenIcon />}
        aria-label={isLocked ? 'Allow AI modification' : 'Prevent AI modification'}
        aria-pressed={isLocked}
        onClick={() => setIsLocked(current => !current)}
      />
    </Tooltip>
  )
}

// An explanation behind an info button, which a phone's reader, with no hover, opens with a tap and
// closes with another or one outside it. Kept open on a click too, since the button does nothing else
export const OpenedOnTap: Story = {
  args: {
    isOpenedOnTap: true,
    isKeptOpenOnPress: true,
    content:
      'What subscribers pay each month, without one-off fees. Paused subscriptions count from the day they resume.',
    children: (
      <Button
        variant="transparent"
        size="sm"
        icon={<InfoIcon />}
        aria-label="What MRR counts"
      />
    ),
  },
}
