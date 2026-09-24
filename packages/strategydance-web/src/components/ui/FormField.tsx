import type { ComponentProps, ReactNode } from 'react'
import { type Control, Controller, type ControllerFieldState, type ControllerRenderProps, type FieldPath, type FieldValues } from 'react-hook-form'
import { Field } from 'strategydance-design-system/components/ui/Field'
import { Input } from 'strategydance-design-system/components/ui/Input'

/*
  One react-hook-form field: the Controller, the design system's Field around the control, its
  label, and the description or the error, which shows only while the field is invalid.

  The control is a render prop rather than a prop of its own because it is the half that
  genuinely varies, while the error half is the one that drifts when the skeleton is written out
  per field: `aria-invalid` and `aria-describedby` are easy to remember separately and easy to
  forget separately
*/

type FormFieldRenderProps<Values extends FieldValues, Name extends FieldPath<Values>> = {
  field: ControllerRenderProps<Values, Name>
  fieldState: ControllerFieldState
  // The id the label points at, so the control does not have to repeat the string
  id: string
  // The id of the description or error under the control, when there is one, for its
  // `aria-describedby`
  describedBy: string | undefined
}

type FormFieldProps<Values extends FieldValues, Name extends FieldPath<Values>> = {
  control: Control<Values>
  name: Name
  id: string
  label?: ReactNode
  description?: ReactNode
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
  className,
  formatError,
  children,
}: FormFieldProps<Values, Name>) {
  const messageId = `${id}-message`

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const error = fieldState.invalid && !!formatError && fieldState.error?.message
          ? formatError(fieldState.error.message)
          : null

        return (
          <Field
            label={label}
            hint={description}
            // `role="alert"` so a field that fails validation after submit is announced, rather
            // than only being seen
            error={error ? <span role="alert">{error}</span> : null}
            htmlFor={id}
            messageId={messageId}
            className={className}
          >
            {children({ field, fieldState, id, describedBy: error || description ? messageId : undefined })}
          </Field>
        )
      }}
    />
  )
}

type FormInputFieldProps<Values extends FieldValues, Name extends FieldPath<Values>> =
  Omit<FormFieldProps<Values, Name>, 'children'>
  & Omit<ComponentProps<typeof Input>, 'id' | 'name' | 'defaultValue' | 'label' | 'hint' | 'error'>

// The overwhelmingly common case: a text input. Everything else goes through `FormField` and
// its render prop
function FormInputField<Values extends FieldValues, Name extends FieldPath<Values>>({
  control,
  name,
  id,
  label,
  description,
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
      className={className}
      formatError={formatError}
    >
      {({ field, fieldState, id: fieldId, describedBy }) => (
        <Input
          {...field}
          {...inputProps}
          id={fieldId}
          aria-invalid={fieldState.invalid}
          aria-describedby={describedBy}
        />
      )}
    </FormField>
  )
}

export { FormField, FormInputField }
