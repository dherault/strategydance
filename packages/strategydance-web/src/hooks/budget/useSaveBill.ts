import { useIntl } from 'react-intl'
import { MAX_BILLS } from 'strategydance-core'
import { BillRecurrence as DatabaseBillRecurrence } from 'strategydance-database/web'
import {
  useCreateBill as useCreateBillMutation,
  useUpdateBill as useUpdateBillMutation,
} from 'strategydance-database/web/react'
import { toast } from 'strategydance-design-system/components/ui/Toaster'

import type { Bill, BillDraft } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useBills from '~hooks/budget/useBills'
import useBudget from '~hooks/budget/useBudget'
import useBudgetExchangeRates from '~hooks/budget/useBudgetExchangeRates'
import useReloadBills from '~hooks/budget/useReloadBills'
import useLocalDate from '~hooks/common/useLocalDate'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import isBillAsDrafted from '~utils/budget/isBillAsDrafted'
import isPushedOverBudget from '~utils/budget/isPushedOverBudget'
import readBillSaveRefusal from '~utils/budget/readBillSaveRefusal'
import toDatabaseCurrency from '~utils/budget/toDatabaseCurrency'

import { dataConnect } from '~data/firebase'
import budgetMessages from '~data/intl/messages/budget'

// What became of a save: done, refused for a reason the dialog acts on, or failed and said so
type BillSaveOutcome =
  | { kind: 'saved' }
  // Somebody saved the bill meanwhile: the dialog shows it as it now is
  | { kind: 'stale'; bill: Bill }
  // The bill was deleted meanwhile
  | { kind: 'gone' }
  // Its receipt can no longer be attached, and is to be attached again
  | { kind: 'receipt' }
  | { kind: 'failed' }

type BillSave = {
  id: string
  draft: BillDraft
  // The `updatedAt` of the bill as the dialog read it, which an edit is saved on, or null for a new bill
  updatedAt: string | null
}

/*
  Saves a bill, new or edited, which any member may, and says so: "{name} added" or "Bill saved",
  or, when the save takes spending over the budget in its own period where it was not, a warning
  that it does. A new bill's id is the dialog's, so a save sent again stores it once.

  A refused save reads the bills again from the server to tell why: a new bill found there was
  added after all, an edited one gone was deleted, and one whose `updatedAt` moved was saved by
  somebody else meanwhile, which the dialog then shows, unless it says what this save wrote, saved by
  the reader, a save that went through though its answer was lost. Anything else is a receipt that can no
  longer be attached, the organization holding every bill it may, or a failure, each said in a toast
*/
function useSaveBill() {
  const { formatMessage } = useIntl()
  const { organization } = useCurrentOrganization()
  const { data: viewer } = useAuthentication()
  const today = useLocalDate()
  const { data: bills } = useBills()
  const { data: settings } = useBudget()
  const { data: rates } = useBudgetExchangeRates(today)
  const { mutateAsync: createBill } = useCreateBillMutation(dataConnect)
  const { mutateAsync: updateBill } = useUpdateBillMutation(dataConnect)
  const reloadBills = useReloadBills()

  function announce({ id, draft, updatedAt }: BillSave) {
    const isOverBudget = isPushedOverBudget({
      bills,
      bill: { id, ...draft },
      budget: settings.limit,
      currency: settings.currency,
      today,
      rates,
    })

    if (isOverBudget) toast.warning(formatMessage(budgetMessages.billOverBudget, { name: draft.name }))
    else if (updatedAt === null) toast.success(formatMessage(budgetMessages.billAdded, { name: draft.name }))
    else toast.success(formatMessage(budgetMessages.billSaved))
  }

  async function readRefusal(save: BillSave, error: unknown): Promise<BillSaveOutcome> {
    const current = (await reloadBills()).find(({ id }) => id === save.id)

    if (save.updatedAt === null && current) {
      announce(save)

      return { kind: 'saved' }
    }

    if (save.updatedAt !== null && !current) {
      toast.error(formatMessage(budgetMessages.billGone))

      return { kind: 'gone' }
    }

    if (current && current.updatedAt !== save.updatedAt) {
      if (current.updatedById === viewer?.uid && isBillAsDrafted(current, save.draft)) {
        announce(save)

        return { kind: 'saved' }
      }

      return { kind: 'stale', bill: current }
    }

    const refusal = readBillSaveRefusal(error)

    if (refusal === 'receipt') {
      toast.error(formatMessage(budgetMessages.receiptExpired))

      return { kind: 'receipt' }
    }

    toast.error(
      refusal === 'full'
        ? formatMessage(budgetMessages.billsFull, { count: MAX_BILLS })
        : formatMessage(budgetMessages.billSaveFailed),
    )

    return { kind: 'failed' }
  }

  return async function saveBill(save: BillSave): Promise<BillSaveOutcome> {
    const { id, draft, updatedAt } = save
    const variables = {
      organizationId: organization!.id,
      id,
      name: draft.name,
      description: draft.description,
      company: draft.company,
      amountMinor: String(draft.amountMinor),
      currency: toDatabaseCurrency(draft.currency),
      paidOn: draft.paidOn,
      recurrence: draft.recurrence ? DatabaseBillRecurrence[draft.recurrence] : null,
      endsOn: draft.endsOn,
      paidById: draft.paidById,
      receiptId: draft.receiptId,
    }

    try {
      if (updatedAt === null) await createBill(variables)
      else await updateBill({ ...variables, updatedAt })
    } catch (error) {
      console.error('Failed to save a bill', error)

      try {
        return await readRefusal(save, error)
      } catch (readError) {
        console.error('Failed to read the bills again after a refused save', readError)
        toast.error(formatMessage(budgetMessages.billSaveFailed))

        return { kind: 'failed' }
      }
    }

    announce(save)
    reloadBills().catch((error: unknown) => console.error('Failed to read the bills again after a save', error))

    return { kind: 'saved' }
  }
}

export { type BillSaveOutcome }

export default useSaveBill
