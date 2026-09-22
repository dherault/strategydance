import { type VariantProps, cva } from 'class-variance-authority'
import type { ComponentProps } from 'react'

import { cn } from '~utils/ui'

import { Label } from '~components/ui/Label'

function FieldSet({ className, ...props }: ComponentProps<'fieldset'>) {
  return (
    <fieldset
      data-slot="field-set"
      className={cn('flex flex-col gap-6', className)}
      {...props}
    />
  )
}

function FieldGroup({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="field-group"
      className={cn('group/field-group @container/field-group flex w-full flex-col gap-4', className)}
      {...props}
    />
  )
}

const fieldVariants = cva(
  'group/field flex w-full gap-1 data-[invalid=true]:text-destructive',
  {
    variants: {
      orientation: {
        vertical: 'flex-col *:w-full [&>.sr-only]:w-auto',
        horizontal: 'flex-row items-center *:data-[slot=field-label]:flex-auto',
      },
    },
    defaultVariants: {
      orientation: 'vertical',
    },
  },
)

type FieldProps = ComponentProps<'div'> & VariantProps<typeof fieldVariants>

function Field({ className, orientation = 'vertical', ...props }: FieldProps) {
  return (
    <div
      role="group"
      data-slot="field"
      data-orientation={orientation}
      className={cn(fieldVariants({ orientation }), className)}
      {...props}
    />
  )
}

function FieldLabel({ className, ...props }: ComponentProps<typeof Label>) {
  return (
    <Label
      data-slot="field-label"
      className={cn('peer/field-label flex w-fit gap-2 leading-snug group-data-[disabled=true]/field:opacity-50', className)}
      {...props}
    />
  )
}

function FieldDescription({ className, ...props }: ComponentProps<'p'>) {
  return (
    <p
      data-slot="field-description"
      className={cn('text-left text-sm leading-normal font-normal text-muted-foreground', className)}
      {...props}
    />
  )
}

// `role="alert"` so a field that fails validation after submit is announced, rather than
// only being seen
function FieldError({ className, children, ...props }: ComponentProps<'div'>) {
  if (!children) return null

  return (
    <div
      role="alert"
      data-slot="field-error"
      className={cn('text-sm font-normal text-destructive', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSet }
