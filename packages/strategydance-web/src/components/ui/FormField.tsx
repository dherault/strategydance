import type { ComponentProps, ReactNode } from 'react'
import { type Control, Controller, type ControllerFieldState, type ControllerRenderProps, type FieldPath, type FieldValues } from 'react-hook-form'

import { Field, FieldDescription, FieldError, FieldLabel } from '~components/ui/Field'
import { Input } from '~components/ui/Input'

/*
  One react-hook-form field: the Controller, the Field wrapper, its label, the control, and the
  error that shows only while the field is invalid.

  The control is a render prop rather than a prop of its own because it is the half that
  genuinely varies, while the error half is the one that drifts when the skeleton is written out
  per field: `aria-invalid` and `data-invalid` are easy to remember separately and easy to
  forget separately
*/

type FormFieldRenderProps<Values extends FieldValues, Name extends FieldPath<Values>> = {
  field: ControllerRenderProps<Values, Name>
  fieldState: ControllerFieldState
  // The id the label points at, so the control does not have to repeat the string
  id: string
}

type FormFieldProps<Values extends FieldValues, Name extends FieldPath<Values>> = {
  control: Control<Values>
  name: Name
  id: string
  label?: ReactNode
  description?: ReactNode
  orientation?: ComponentProps<typeof Field>['orientation']
  className?: string
  /*
    Renders what the field failed with. Its argument is the zod message, which for every form
    here is a message *id* resolved through the intl catalogue rather than a literal, so pass
    something that can look one up
  */
  formatError?: (messageId: string) => ReactNode
  children: (renderProps: FormFieldRenderProps<Values, Name>) => ReactNode
}

function FormField<Values extends FieldValues, Name extends FieldPath<Values>>({
  control,
  name,
  id,
  label,
  description,
  orientation,
  className,
  formatError,
  children,
}: FormFieldProps<Values, Name>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field
          data-invalid={fieldState.invalid}
          orientation={orientation}
          className={className}
        >
          {!!label && (
            <FieldLabel htmlFor={id}>
              {label}
            </FieldLabel>
          )}
          {children({ field, fieldState, id })}
          {!!description && (
            <FieldDescription>
              {description}
            </FieldDescription>
          )}
          {fieldState.invalid && !!formatError && (
            <FieldError>
              {fieldState.error?.message ? formatError(fieldState.error.message) : null}
            </FieldError>
          )}
        </Field>
      )}
    />
  )
}

type FormInputFieldProps<Values extends FieldValues, Name extends FieldPath<Values>> =
  Omit<FormFieldProps<Values, Name>, 'children'>
  & Omit<ComponentProps<typeof Input>, 'id' | 'name' | 'defaultValue'>

// The overwhelmingly common case: a text input. Everything else goes through `FormField` and
// its render prop
function FormInputField<Values extends FieldValues, Name extends FieldPath<Values>>({
  control,
  name,
  id,
  label,
  description,
  orientation,
  className,
  formatError,
  ...inputProps
}: FormInputFieldProps<Values, Name>) {
  return (
    <FormField
      control={control}
      name={name}
      id={id}
      label={label}
      description={description}
      orientation={orientation}
      className={className}
      formatError={formatError}
    >
      {({ field, fieldState, id: fieldId }) => (
        <Input
          {...field}
          {...inputProps}
          id={fieldId}
          aria-invalid={fieldState.invalid}
        />
      )}
    </FormField>
  )
}

export { FormField, FormInputField }
