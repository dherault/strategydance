import { zodResolver } from '@hookform/resolvers/zod'
import { useId, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useIntl } from 'react-intl'
import { type Currency, formatMoneyAmount, isCurrency, parseMoney } from 'strategydance-core'
import { OrganizationRole } from 'strategydance-database/web'
import { Button } from 'strategydance-design-system/components/ui/Button'
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from 'strategydance-design-system/components/ui/Dialog'
import { fieldLabelClassName } from 'strategydance-design-system/components/ui/Field'
import { Radio } from 'strategydance-design-system/components/ui/Radio'
import { toast } from 'strategydance-design-system/components/ui/Toaster'
import * as z from 'zod'

import useBudget from '~hooks/budget/useBudget'
import useBudgetExchangeRates from '~hooks/budget/useBudgetExchangeRates'
import useSetBudget from '~hooks/budget/useSetBudget'
import useLocalDate from '~hooks/common/useLocalDate'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import formatBudgetDay from '~utils/budget/formatBudgetDay'
import getLatestExchangeRateDay from '~utils/budget/getLatestExchangeRateDay'

import CurrencySelect from '~components/budget/CurrencySelect'
import Spinner from '~components/common/Spinner'
import { FormInputField } from '~components/ui/FormField'

import budgetMessages from '~data/intl/messages/budget'

const BUDGET_PERIODS = ['MONTHLY', 'QUARTERLY', 'YEARLY'] as const

const PERIOD_MESSAGES = {
  MONTHLY: budgetMessages.periodMonthly,
  QUARTERLY: budgetMessages.periodQuarterly,
  YEARLY: budgetMessages.periodYearly,
}

// zod carries a key of the budget catalogue rather than a sentence, formatted in the reader's
// language at render. The amount is checked in its currency, whose digits it may not pass
const budgetFormSchema = z
  .object({
    period: z.enum(BUDGET_PERIODS),
    amount: z.string(),
    currency: z.custom<Currency>(isCurrency),
  })
  .refine(({ amount, currency }) => (parseMoney(amount.trim(), currency) ?? 0) > 0, {
    message: 'amountInvalid',
    path: ['amount'],
  })

type BudgetFormValues = z.infer<typeof budgetFormSchema>

type Props = {
  onClose: () => void
}

/*
  The budget's form: its period, its amount per period and its currency, which every amount of the
  page is converted to. An administrator saves or removes it, removing keeping the currency; a
  member sees it, every field disabled, with no action. Its errors show once it was submitted
*/
function BudgetDialogForm({ onClose }: Props) {
  const { formatMessage, locale } = useIntl()
  const periodLabelId = useId()
  const amountId = useId()
  const { role } = useCurrentOrganization()
  const { data: settings } = useBudget()
  const today = useLocalDate()
  const { data: rates } = useBudgetExchangeRates(today)
  const { setBudget } = useSetBudget()
  const [isRemoving, setIsRemoving] = useState(false)

  const { limit } = settings
  const isAdministrator = role === OrganizationRole.ADMINISTRATOR
  const latestRateDay = getLatestExchangeRateDay(rates)

  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: {
      period: limit?.period ?? 'MONTHLY',
      amount: limit ? formatMoneyAmount(limit.amountMinor, settings.currency) : '',
      currency: settings.currency,
    },
  })
  const period = useWatch({ control: form.control, name: 'period' })
  const currency = useWatch({ control: form.control, name: 'currency' })
  const { isDirty, isSubmitting } = form.formState

  function formatError(key: string) {
    return formatMessage(budgetMessages[key as keyof typeof budgetMessages])
  }

  async function save(values: BudgetFormValues) {
    try {
      await setBudget({
        currency: values.currency,
        limit: { amountMinor: parseMoney(values.amount.trim(), values.currency)!, period: values.period },
      })

      toast.success(formatMessage(budgetMessages.budgetSaved))
      onClose()
    } catch (error) {
      console.error('Failed to save the budget', error)

      toast.error(formatMessage(budgetMessages.saveFailed))
    }
  }

  async function remove() {
    setIsRemoving(true)

    try {
      await setBudget({ currency: settings.currency, limit: null })

      toast.success(formatMessage(budgetMessages.budgetRemoved))
      onClose()
    } catch (error) {
      console.error('Failed to remove the budget', error)

      toast.error(formatMessage(budgetMessages.removeFailed))
      setIsRemoving(false)
    }
  }

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(save)}
      className="grid gap-6"
    >
      <DialogHeader>
        <DialogTitle>{formatMessage(limit ? budgetMessages.dialogTitle : budgetMessages.dialogTitleNew)}</DialogTitle>
        <DialogDescription>
          {formatMessage(isAdministrator ? budgetMessages.dialogDescription : budgetMessages.dialogReadOnly)}
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <Controller
          control={form.control}
          name="period"
          render={({ field }) => (
            <div className="flex flex-col gap-2">
              <span
                id={periodLabelId}
                className={fieldLabelClassName}
              >
                {formatMessage(budgetMessages.periodLabel)}
              </span>
              <div
                role="radiogroup"
                aria-labelledby={periodLabelId}
                className="flex flex-wrap gap-x-6 gap-y-2"
              >
                {BUDGET_PERIODS.map(budgetPeriod => (
                  <Radio
                    key={budgetPeriod}
                    name={field.name}
                    value={budgetPeriod}
                    label={formatMessage(PERIOD_MESSAGES[budgetPeriod])}
                    checked={field.value === budgetPeriod}
                    disabled={!isAdministrator}
                    onChange={() => field.onChange(budgetPeriod)}
                    onBlur={field.onBlur}
                  />
                ))}
              </div>
            </div>
          )}
        />
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px] sm:gap-3">
          <FormInputField
            control={form.control}
            name="amount"
            id={amountId}
            label={formatMessage(budgetMessages.amountLabel, { period })}
            formatError={formatError}
            inputMode="decimal"
            autoComplete="off"
            placeholder="2500"
            disabled={!isAdministrator}
          />
          <Controller
            control={form.control}
            name="currency"
            render={({ field }) => (
              <CurrencySelect
                label={formatMessage(budgetMessages.currencyLabel)}
                value={field.value}
                onValueChange={field.onChange}
                disabled={!isAdministrator}
              />
            )}
          />
        </div>
        <p className="m-0 text-sm text-pretty text-muted-foreground">
          {latestRateDay
            ? formatMessage(budgetMessages.conversionNote, {
                currency,
                date: formatBudgetDay(latestRateDay, today, locale, { withYear: true }),
              })
            : formatMessage(budgetMessages.conversionNoteUndated, { currency })}
        </p>
      </div>
      {isAdministrator ? (
        <DialogFooter className="-mx-6 -mb-6 border-t border-border px-6 py-4 sm:items-center">
          {limit ? (
            <span className="min-w-0 flex-1">
              <Button
                variant="transparent"
                size="sm"
                disabled={isRemoving || isSubmitting}
                icon={isRemoving ? <Spinner tone="current" /> : undefined}
                confirm={formatMessage(budgetMessages.removeBudgetConfirm)}
                onClick={remove}
              >
                {formatMessage(budgetMessages.removeBudget)}
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
            disabled={!isDirty || isSubmitting || isRemoving}
            icon={isSubmitting ? <Spinner tone="current" /> : undefined}
          >
            {formatMessage(budgetMessages.save)}
          </Button>
        </DialogFooter>
      ) : null}
    </form>
  )
}

export default BudgetDialogForm
