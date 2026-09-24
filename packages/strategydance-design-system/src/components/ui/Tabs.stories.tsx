import type { Meta, StoryObj } from '@storybook/react-vite'
import { CalendarIcon, ListTodoIcon, MessageSquareIcon } from 'lucide-react'

import { Tabs } from 'strategydance-design-system/components/ui/Tabs'

const meta = {
  title: 'Components/Tabs',
  component: Tabs,
  args: {
    'aria-label': 'Project',
    items: [
      { value: 'tasks', label: 'Tasks', count: 12, content: '12 tasks, 3 due this week.' },
      { value: 'calendar', label: 'Calendar', content: 'Two calls on Thursday.' },
      { value: 'notes', label: 'Notes', count: 3, content: 'Three notes since Monday.' },
      { value: 'archive', label: 'Archive', disabled: true, content: 'Nothing archived yet.' },
    ],
  },
} satisfies Meta<typeof Tabs>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithIcons: Story = {
  args: {
    items: [
      { value: 'tasks', label: 'Tasks', icon: <ListTodoIcon />, count: 12 },
      { value: 'calendar', label: 'Calendar', icon: <CalendarIcon /> },
      { value: 'messages', label: 'Messages', icon: <MessageSquareIcon />, count: 3 },
    ],
  },
}

export const Small: Story = {
  args: {
    size: 'sm',
  },
}

export const FullWidth: Story = {
  args: {
    fullWidth: true,
    className: 'max-w-lg',
  },
}
