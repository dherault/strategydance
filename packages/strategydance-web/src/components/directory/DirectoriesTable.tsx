import { useIntl } from 'react-intl'
import { Table, TableBody, TableHead, TableHeader, TableRow } from 'strategydance-design-system/components/ui/Table'
import type { Directory } from 'strategydance-knowledge/src/directories/types'

import type { DirectoryState } from '~types'

import DirectoryRow from '~components/directory/DirectoryRow'

import directoryMessages from '~data/intl/messages/directory'

type Props = {
  // Filtered already, in the catalogue's order
  directories: readonly Directory[]
  states: ReadonlyMap<string, DirectoryState>
}

/*
  The directories the page lists, one a row. The page around it is a container, so the categories
  go once it, not the window, grows narrow, then what each charges, then the link to the
  submission page, which the dialog offers too, leaving each directory's name and status
*/
function DirectoriesTable({ directories, states }: Props) {
  const { formatMessage } = useIntl()

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{formatMessage(directoryMessages.columnDirectory)}</TableHead>
          <TableHead className="@max-[560px]:hidden">{formatMessage(directoryMessages.columnPricing)}</TableHead>
          <TableHead className="@max-[800px]:hidden">{formatMessage(directoryMessages.columnCategories)}</TableHead>
          <TableHead>{formatMessage(directoryMessages.columnStatus)}</TableHead>
          <TableHead className="w-px pl-0 @max-[480px]:hidden">
            <span className="sr-only">{formatMessage(directoryMessages.columnSubmission)}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {directories.map(directory => (
          <DirectoryRow
            key={directory.id}
            directory={directory}
            state={states.get(directory.id)}
          />
        ))}
      </TableBody>
    </Table>
  )
}

export default DirectoriesTable
