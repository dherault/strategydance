import { zodResolver } from '@hookform/resolvers/zod'
import { Trash2Icon } from 'lucide-react'
import { type ReactNode, useId, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useIntl } from 'react-intl'
import {
  BILL_DAYS_AHEAD,
  type BillReceiptData,
  type BillReceiptFields,
  type BillRecurrence,
  type Currency,
  CURRENCIES,
  FIRST_BILL_DAY,
  MAX_BILL_COMPANY_LENGTH,
  MAX_BILL_DESCRIPTION_LENGTH,
  MAX_BILL_NAME_LENGTH,
  addCalendarDays,
  addCalendarMonths,
  isCurrency,
} from 'strategydance-core'
import { Alert } from 'strategydance-design-system/components/ui/Alert'
import { Button } from 'strategydance-design-system/components/ui/Button'
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from 'strategydance-design-system/components/ui/Dialog'
import { Select } from 'strategydance-design-system/components/ui/Select'
import { Switch } from 'strategydance-design-system/components/ui/Switch'
import { Textarea } from 'strategydance-design-system/components/ui/Textarea'
import * as z from 'zod'

import type { Bill } from '~types'

import useAuthentication from '~hooks/authentication/useAuthentication'
import useBillPayers from '~hooks/budget/useBillPayers'
import useBillReceiptDraft from '~hooks/budget/useBillReceiptDraft'
import useBills from '~hooks/budget/useBills'
import useBudget from '~hooks/budget/useBudget'
import useDeleteBill from '~hooks/budget/useDeleteBill'
import useSaveBill from '~hooks/budget/useSaveBill'
import useLocalDate from '~hooks/common/useLocalDate'

import { formatAmountPlaceholder } from '~utils/budget/formatAmountInput'
import formatBudgetAmount from '~utils/budget/formatBudgetAmount'
import listBillCompanies from '~utils/budget/listBillCompanies'
import listChangedBillFields from '~utils/budget/listChangedBillFields'
import readAmountInput, { AMOUNT_INPUT_ERRORS, readAmountMinor } from '~utils/budget/readAmountInput'
import toBillDraft from '~utils/budget/toBillDraft'
import toBillFormValues, { type BillFormValues } from '~utils/budget/toBillFormValues'
import toBillFormValuesFromReceipt from '~utils/budget/toBillFormValuesFromReceipt'
import createId from '~utils/common/createId'

import BillCompanyField from '~components/budget/BillCompanyField'
import BillDayField from '~components/budget/BillDayField'
import BillDialogHistory from '~components/budget/BillDialogHistory'
import BillEarlierReceipts from '~components/budget/BillEarlierReceipts'
import BillPayerOption from '~components/budget/BillPayerOption'
import BillReceiptField from '~components/budget/BillReceiptField'
import CurrencySelect from '~components/budget/CurrencySelect'
import Spinner from '~components/common/Spinner'
import { FormField, FormInputField } from '~components/ui/FormField'

import budgetMessages from '~data/intl/messages/budget'

const BILL_RECURRENCES = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'] as const satisfies readonly BillRecurrence[]

// zod carries a key of the budget catalogue rather than a sentence, formatted in the reader's
// language at render. The amount is read as `readAmountInput` reads it, in its currency, whose
// digits it may not pass, and an end only while the bill recurs
const billFormSchema = z
  .object({
    name: z.string().refine(name => name.trim() !== '', 'nameRequired'),
    description: z.string(),
    company: z.string().refine(company => company.trim() !== '', 'companyRequired'),
    amount: z.string(),
    currency: z.custom<Currency>(isCurrency),
    paidOn: z
      .string()
      .nullable()
      .refine(paidOn => paidOn !== null, 'dayRequired'),
    paidById: z.string(),
    isRecurring: z.boolean(),
    recurrence: z.enum(BILL_RECURRENCES),
    endsOn: z.string().nullable(),
    receiptId: z.string().nullable(),
  })
  .superRefine(({ amount, currency }, context) => {
    const read = readAmountInput(amount, currency)

    if (read.outcome !== 'amount') {
      context.addIssue({ code: 'custom', message: AMOUNT_INPUT_ERRORS[read.outcome], path: ['amount'] })
    }
  })
  .refine(({ isRecurring, paidOn, endsOn }) => !isRecurring || !paidOn || !endsOn || endsOn >= paidOn, {
    message: 'endsInvalid',
    path: ['endsOn'],
  })

/*
  What a new bill starts from once its receipt went up through the upload dialog: the receipt,
  attached, what the receipt reader found in it, or null when it read nothing, and the notice that
  says so above the fields
*/
type BillFormDraft = {
  receipt: BillReceiptData
  fields: BillReceiptFields | null
  notice: ReactNode
}

type Props = {
  // The bill to change, or null for a new one
  bill: Bill | null
  // A new bill's start, from its receipt
  draft?: BillFormDraft | null
  onClose: () => void
}

/*
  A bill's form, new or existing: its name, description and company, its amount in its own currency,
  the day it was paid, or first paid while it recurs, who paid it, how often it repeats and until
  when, and its receipt, which goes up as soon as it is attached. A save waits for that upload.
  Saved over a save somebody made meanwhile, it says so and shows the bill as it now is, on which a
  save goes through. Its errors show once it was submitted. Its fields scroll between its header
  and its actions, which stay in view, as the design has it. A new bill can start from its receipt,
  filled in with what the receipt reader found, under a notice saying where it came from
*/
function BillDialogForm({ bill, draft = null, onClose }: Props) {
  const { formatMessage, locale } = useIntl()
  const nameId = useId()
  const descriptionId = useId()
  const companyId = useId()
  const amountId = useId()
  const paidOnId = useId()
  const paidById = useId()
  const recurrenceId = useId()
  const endsOnId = useId()
  const today = useLocalDate()
  const { data: viewer } = useAuthentication()
  const { data: settings } = useBudget()
  const { data: bills } = useBills()
  const payers = useBillPayers()
  const saveBill = useSaveBill()
  const deleteBill = useDeleteBill()
  // A new bill's id, made once, so a save sent again stores it once
  const [id] = useState(() => bill?.id ?? createId())
  // The `updatedAt` an edit is saved on: the bill's as the form read it
  const [updatedAt, setUpdatedAt] = useState(bill?.updatedAt ?? null)
  const [isStale, setIsStale] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const defaults = { currency: settings.currency, today, viewerId: viewer?.uid ?? '', locale }
  const form = useForm<BillFormValues>({
    resolver: zodResolver(billFormSchema),
    defaultValues:
      !bill && draft
        ? toBillFormValuesFromReceipt(draft.fields, draft.receipt.id, defaults)
        : toBillFormValues(bill, defaults),
  })
  const receipt = useBillReceiptDraft(bill?.receipt ?? draft?.receipt ?? null, receiptId =>
    form.setValue('receiptId', receiptId, { shouldDirty: true }),
  )
  const [name, company, amount, currency, paidOn, payerId, isRecurring] = useWatch({
    control: form.control,
    name: ['name', 'company', 'amount', 'currency', 'paidOn', 'paidById', 'isRecurring'],
  })
  const { isDirty, isSubmitting } = form.formState

  const companies = listBillCompanies(bills, locale)
  // The members, and whoever paid this bill should they have left since
  const payerOptions = payers
    .filter(payer => !payer.hasLeft || payer.id === payerId || payer.id === bill?.paidById)
    .map(payer => ({ value: payer.id, label: <BillPayerOption payer={payer} /> }))
  const amountMinor = readAmountMinor(amount, currency)
  const receiptDetails = [
    company.trim(),
    amountMinor ? formatBudgetAmount(amountMinor, currency, locale, { exact: true }) : '',
  ]
  const lastDay = addCalendarDays(today, BILL_DAYS_AHEAD)

  // An amount's error names its currency and the decimals it takes, which the others ignore
  function formatError(key: string) {
    return formatMessage(budgetMessages[key as keyof typeof budgetMessages], {
      currency,
      count: CURRENCIES[currency].exponent,
    })
  }

  async function save(values: BillFormValues) {
    if (!(await receipt.settle())) return

    const draft = toBillDraft({ ...values, receiptId: form.getValues('receiptId') })

    if (!draft) return

    const outcome = await saveBill({ id, draft, updatedAt })

    if (outcome.kind === 'saved' || outcome.kind === 'gone') {
      onClose()

      return
    }

    // Somebody saved the bill meanwhile: the dialog shows it as they saved it, with what the reader
    // changed since the dialog read it laid over, as an agent's update lays its fields, so neither
    // change is lost, and the next save goes through on it
    if (outcome.kind === 'stale') {
      const typed = form.getValues()
      const changed = listChangedBillFields(form.formState.defaultValues as BillFormValues, typed)

      form.reset(toBillFormValues(outcome.bill, defaults))

      for (const field of changed) form.setValue(field, typed[field], { shouldDirty: true })

      if (!changed.includes('receiptId')) receipt.reset(outcome.bill.receipt ?? null)

      setUpdatedAt(outcome.bill.updatedAt)
      setIsStale(true)

      return
    }

    // The receipt attached can no longer be: a bill goes back to its own, which the reader can replace
    // again, and a new one to none
    if (outcome.kind === 'receipt') {
      if (bill?.receipt) {
        receipt.reset(bill.receipt)
        form.setValue('receiptId', bill.receipt.id, { shouldDirty: true })
      } else {
        receipt.remove()
      }
    }
  }

  function remove() {
    if (!bill) return

    setIsDeleting(true)
    onClose()
    deleteBill(bill)
  }

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(save)}
      className="flex min-h-0 flex-1 flex-col"
    >
      <DialogHeader className="px-6 pt-6 pb-5">
        <DialogTitle>{formatMessage(bill ? budgetMessages.editBill : budgetMessages.newBill)}</DialogTitle>
        <DialogDescription>
          {bill ? (
            <BillDialogHistory
              bill={bill}
              today={today}
            />
          ) : (
            formatMessage(budgetMessages.newBillDescription)
          )}
        </DialogDescription>
      </DialogHeader>
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-6 pt-0.5 pb-6">
        {isStale ? <Alert variant="warning">{formatMessage(budgetMessages.billStale)}</Alert> : null}
        {!bill && draft ? draft.notice : null}
        <FormInputField
          control={form.control}
          name="name"
          id={nameId}
          label={formatMessage(budgetMessages.nameLabel)}
          formatError={formatError}
          autoComplete="off"
          maxLength={MAX_BILL_NAME_LENGTH}
          placeholder={formatMessage(budgetMessages.namePlaceholder)}
        />
        <FormField
          control={form.control}
          name="description"
          id={descriptionId}
          label={formatMessage(budgetMessages.descriptionLabel)}
        >
          {({ field, id: fieldId, describedBy }) => (
            <Textarea
              {...field}
              id={fieldId}
              rows={2}
              autosize
              maxRows={4}
              maxLength={MAX_BILL_DESCRIPTION_LENGTH}
              placeholder={formatMessage(budgetMessages.descriptionPlaceholder)}
              aria-describedby={describedBy}
            />
          )}
        </FormField>
        <FormField
          control={form.control}
          name="company"
          id={companyId}
          label={formatMessage(budgetMessages.companyLabel)}
          formatError={formatError}
        >
          {({ field, fieldState, id: fieldId, describedBy }) => (
            <BillCompanyField
              ref={field.ref}
              id={fieldId}
              value={field.value}
              companies={companies}
              maxLength={MAX_BILL_COMPANY_LENGTH}
              isInvalid={fieldState.invalid}
              describedBy={describedBy}
              onChange={field.onChange}
              onBlur={field.onBlur}
            />
          )}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px] sm:gap-3">
          <FormInputField
            control={form.control}
            name="amount"
            id={amountId}
            label={formatMessage(budgetMessages.billAmountLabel)}
            formatError={formatError}
            inputMode="decimal"
            autoComplete="off"
            placeholder={formatAmountPlaceholder(currency, locale)}
          />
          <Controller
            control={form.control}
            name="currency"
            render={({ field }) => (
              <CurrencySelect
                label={formatMessage(budgetMessages.currencyLabel)}
                value={field.value}
                onValueChange={field.onChange}
              />
            )}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-3">
          <FormField
            control={form.control}
            name="paidOn"
            id={paidOnId}
            label={formatMessage(isRecurring ? budgetMessages.firstPaymentLabel : budgetMessages.paidOnLabel)}
            formatError={formatError}
          >
            {({ field, fieldState, id: fieldId, describedBy }) => (
              <BillDayField
                id={fieldId}
                value={field.value}
                today={today}
                from={FIRST_BILL_DAY}
                to={lastDay}
                isInvalid={fieldState.invalid}
                describedBy={describedBy}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          </FormField>
          <FormField
            control={form.control}
            name="paidById"
            id={paidById}
            label={formatMessage(budgetMessages.paidBy)}
          >
            {({ field, id: fieldId }) => (
              <Select
                id={fieldId}
                value={field.value}
                options={payerOptions}
                onValueChange={field.onChange}
              />
            )}
          </FormField>
        </div>
        <div className="flex flex-col gap-3 rounded-xs border border-neutral-200 p-3">
          <Controller
            control={form.control}
            name="isRecurring"
            render={({ field }) => (
              <Switch
                ref={field.ref}
                name={field.name}
                checked={field.value}
                label={formatMessage(budgetMessages.recurringLabel)}
                hint={formatMessage(budgetMessages.recurringHint)}
                onChange={event => field.onChange(event.target.checked)}
                onBlur={field.onBlur}
              />
            )}
          />
          {isRecurring ? (
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-3">
              <FormField
                control={form.control}
                name="recurrence"
                id={recurrenceId}
                label={formatMessage(budgetMessages.repeatsLabel)}
              >
                {({ field, id: fieldId }) => (
                  <Select
                    id={fieldId}
                    value={field.value}
                    options={BILL_RECURRENCES.map(recurrence => ({
                      value: recurrence,
                      label: formatMessage(budgetMessages.recurrence, { recurrence }),
                    }))}
                    onValueChange={field.onChange}
                  />
                )}
              </FormField>
              <FormField
                control={form.control}
                name="endsOn"
                id={endsOnId}
                label={formatMessage(budgetMessages.endsLabel)}
                description={formatMessage(budgetMessages.endsHint)}
                formatError={formatError}
              >
                {({ field, fieldState, id: fieldId, describedBy }) => (
                  <BillDayField
                    id={fieldId}
                    value={field.value}
                    today={today}
                    from={paidOn ?? FIRST_BILL_DAY}
                    to={addCalendarMonths(lastDay, 600)}
                    isClearable
                    isInvalid={fieldState.invalid}
                    describedBy={describedBy}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              </FormField>
            </div>
          ) : null}
        </div>
        <BillReceiptField
          draft={receipt.draft}
          billName={name.trim()}
          details={receiptDetails}
          onAttach={receipt.attach}
          onRemove={receipt.remove}
        />
        {bill ? (
          <BillEarlierReceipts
            billId={bill.id}
            heldId={receipt.draft.status === 'none' ? null : receipt.draft.receipt.id}
            billName={name.trim()}
            details={receiptDetails}
            onTakeBack={receipt.takeBack}
          />
        ) : null}
      </div>
      <DialogFooter className="flex-row items-center justify-end border-t border-border px-6 py-4">
        {bill ? (
          <span className="min-w-0 flex-1">
            <Button
              variant="danger"
              size="sm"
              icon={<Trash2Icon />}
              disabled={isDeleting || isSubmitting}
              confirm={formatMessage(budgetMessages.deleteBillConfirm)}
              onClick={remove}
            >
              {formatMessage(budgetMessages.deleteBill)}
            </Button>
          </span>
        ) : null}
        <Button
          variant="transparent"
          onClick={onClose}
        >
          {formatMessage(budgetMessages.cancel)}
        </Button>
        <Button
          type="submit"
          disabled={(bill !== null && !isDirty) || isSubmitting || isDeleting}
          icon={isSubmitting ? <Spinner tone="current" /> : undefined}
        >
          {formatMessage(bill ? budgetMessages.save : budgetMessages.addBill)}
        </Button>
      </DialogFooter>
    </form>
  )
}

export { type BillFormDraft }

export default BillDialogForm
