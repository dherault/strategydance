import type { Meta, StoryObj } from '@storybook/react-vite'
import { type ComponentProps, useState } from 'react'

import { Badge } from 'strategydance-design-system/components/ui/Badge'
import { Checkbox } from 'strategydance-design-system/components/ui/Checkbox'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from 'strategydance-design-system/components/ui/Table'

const invoices = [
  { id: 'INV-1041', client: 'Northwind Ltd', status: 'Paid', variant: 'success', amount: '$2,400.00' },
  { id: 'INV-1042', client: 'Acme Studio', status: 'Pending', variant: 'warning', amount: '$1,150.00' },
  { id: 'INV-1043', client: 'Blue Harbor', status: 'Paid', variant: 'success', amount: '$780.00' },
  { id: 'INV-1044', client: 'Kestrel & Co', status: 'Overdue', variant: 'danger', amount: '$3,200.00' },
  { id: 'INV-1045', client: 'Fieldstone', status: 'Draft', variant: 'neutral', amount: '$540.00' },
] as const

// The design's own demo: a selection column, status badges, a caption and a footer total
function Invoices(props: ComponentProps<typeof Table>) {
  const [selectedIds, setSelectedIds] = useState<string[]>(['INV-1042'])

  const allSelected = selectedIds.length === invoices.length

  function toggle(id: string) {
    setSelectedIds(ids => (ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]))
  }

  return (
    <Table {...props}>
      <TableCaption>
        {`Recent invoices · ${selectedIds.length} selected`}
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>
            <Checkbox
              aria-label="Select all"
              checked={allSelected}
              indeterminate={selectedIds.length > 0 && !allSelected}
              onChange={() => setSelectedIds(allSelected ? [] : invoices.map(({ id }) => id))}
            />
          </TableHead>
          <TableHead>
            Invoice
          </TableHead>
          <TableHead>
            Client
          </TableHead>
          <TableHead>
            Status
          </TableHead>
          <TableHead align="right">
            Amount
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map(invoice => (
          <TableRow
            key={invoice.id}
            selected={selectedIds.includes(invoice.id)}
          >
            <TableCell>
              <Checkbox
                aria-label={`Select ${invoice.id}`}
                checked={selectedIds.includes(invoice.id)}
                onChange={() => toggle(invoice.id)}
              />
            </TableCell>
            <TableCell className="font-medium text-secondary">
              {invoice.id}
            </TableCell>
            <TableCell>
              {invoice.client}
            </TableCell>
            <TableCell>
              <Badge
                variant={invoice.variant}
                size="sm"
                dot
              >
                {invoice.status}
              </Badge>
            </TableCell>
            <TableCell align="right">
              {invoice.amount}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={4}>
            Total
          </TableCell>
          <TableCell align="right">
            $8,070.00
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  )
}

const meta = {
  title: 'Components/Table',
  component: Table,
  args: {
    density: 'md',
    striped: false,
    bordered: true,
  },
  render: args => <Invoices {...args} />,
} satisfies Meta<typeof Table>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Striped: Story = {
  args: {
    striped: true,
  },
}

export const Small: Story = {
  args: {
    density: 'sm',
  },
}

export const Borderless: Story = {
  args: {
    bordered: false,
  },
}
