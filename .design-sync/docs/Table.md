Rows and columns for records read side by side: the team's members, an organization's
integrations, a month's spend. It is the shadcn anatomy: `Table` holds a `TableHeader`, a
`TableBody` and an optional `TableFooter`, each of `TableRow`s made of `TableHead` or `TableCell`,
in a white frame that scrolls sideways when the table is wider than its container. Documents or
anything shown as cards go in a grid instead.

## Usage

```jsx
const { Avatar, Badge, Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } = window.StrategyDanceDesignSystem
const { EllipsisIcon } = window.StrategyDanceDesignSystem.Icons

const members = [
  { id: 'maya', name: 'Maya Laurent', email: 'maya@acme.com', jobTitle: 'Founder', access: 'Administrator' },
  { id: 'tom', name: 'Tom Harris', email: 'tom@acme.com', jobTitle: 'Growth', access: 'Member' },
  { id: 'ines', name: 'Inès Moreau', email: 'ines@acme.com', jobTitle: 'Engineer', access: 'Member' },
]

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Email</TableHead>
      <TableHead>Job title</TableHead>
      <TableHead>Access</TableHead>
      <TableHead className="w-px">
        <span className="sr-only">Actions</span>
      </TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {members.map(member => (
      <TableRow key={member.id}>
        <TableCell>
          <div className="flex items-center gap-2">
            <Avatar name={member.name} alt="" />
            <span className="font-medium text-secondary">{member.name}</span>
          </div>
        </TableCell>
        <TableCell>{member.email}</TableCell>
        <TableCell>{member.jobTitle}</TableCell>
        <TableCell>
          <Badge variant={member.access === 'Administrator' ? 'primary' : 'neutral'}>{member.access}</Badge>
        </TableCell>
        <TableCell>
          <Button variant="transparent" size="sm" icon={<EllipsisIcon />} aria-label={`Actions for ${member.name}`} />
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

Dense and striped, with a selection column, figures aligned right, a total and a caption:

```jsx
const { Checkbox, Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow } = window.StrategyDanceDesignSystem

function SpendTable() {
  const lines = [
    { id: 'ads', item: 'Ads on LinkedIn', aspect: 'Marketing', amount: '$1,200.00' },
    { id: 'brand', item: 'Brand designer', aspect: 'Design', amount: '$2,400.00' },
    { id: 'terms', item: 'Terms of service review', aspect: 'Legal', amount: '$650.00' },
  ]
  const [selectedIds, setSelectedIds] = React.useState(['brand'])
  const isAllSelected = selectedIds.length === lines.length

  function toggle(id) {
    setSelectedIds(ids => (ids.includes(id) ? ids.filter(other => other !== id) : [...ids, id]))
  }

  return (
    <Table density="sm" striped>
      <TableCaption>{`This month's spend, ${selectedIds.length} selected`}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>
            <Checkbox
              aria-label="Select every line"
              checked={isAllSelected}
              indeterminate={selectedIds.length > 0 && !isAllSelected}
              onChange={() => setSelectedIds(isAllSelected ? [] : lines.map(line => line.id))}
            />
          </TableHead>
          <TableHead>Item</TableHead>
          <TableHead>Aspect</TableHead>
          <TableHead align="right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map(line => (
          <TableRow key={line.id} selected={selectedIds.includes(line.id)}>
            <TableCell>
              <Checkbox
                aria-label={`Select ${line.item}`}
                checked={selectedIds.includes(line.id)}
                onChange={() => toggle(line.id)}
              />
            </TableCell>
            <TableCell className="font-medium text-secondary">{line.item}</TableCell>
            <TableCell>{line.aspect}</TableCell>
            <TableCell align="right">{line.amount}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={3}>Total</TableCell>
          <TableCell align="right">$4,250.00</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  )
}
```

## Parts

- `Table`: the `<table>` inside its scroll wrapper, with the props below. `className` styles the
  table, `containerClassName` the wrapper
- `TableHeader`: the `<thead>`, its row on neutral-50
- `TableBody`: the `<tbody>`, whose rows tint on hover
- `TableFooter`: the `<tfoot>`, for a total, in medium navy on neutral-50
- `TableRow`: a `<tr>`. `selected` fills it pale blue over the stripe and the hover, and sets
  `aria-selected`
- `TableHead`: a column's `<th>`, in muted `text-xs`. `align` is `left`, `center` or `right`
- `TableCell`: a `<td>`. `align` as on `TableHead`, `right` also lining up the digits, for figures.
  `colSpan` and the rest of a `<td>`'s attributes pass through
- `TableCaption`: a `<caption>`, a muted line at the table's foot. Write it first inside `Table`,
  as HTML wants: it still shows at the bottom

Each part takes its element's attributes and `className`. The minimal composition is `Table`
around `TableHeader` and `TableBody`, each holding `TableRow`s of `TableHead` or `TableCell`.

## Notes

- There is no `columns` or `data` prop: map the records into `TableRow`s. Sorting, paging and
  selection are the page's, as above
- `density` is `md`, rows 48px tall, unless `sm` makes them 40px. It is set once on `Table`, and
  every row and cell follows it
- `bordered` is on unless set: a grey frame with the xs radius. `bordered={false}` suits a table
  inside a Card or a Dialog, which already frames it
- `striped` fills every other body row in neutral-50
- Cells stay on one line: each column is as wide as its widest content, and a table wider than its
  container scrolls sideways rather than wrapping. The wrapper takes the keyboard's focus only
  while it scrolls
- A column of checkboxes narrows itself to the checkbox. `className="w-px"` on a `TableHead`
  narrows a column of buttons the same way
- A button that only shows an icon in a row needs an `aria-label` naming its row
