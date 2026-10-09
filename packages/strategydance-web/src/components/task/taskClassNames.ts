// A value in a task's dialog that a click turns into its editor, as the design has them: the box
// pulled out by its padding so the text stays in line with the labels, and tinted under the pointer
export const TASK_EDITABLE_CLASS_NAME =
  '-mx-2 box-border block w-[calc(100%+1rem)] cursor-pointer rounded-xs border-0 bg-transparent px-2 py-1 text-left font-[inherit] text-[length:inherit] leading-[inherit] text-inherit transition-colors duration-150 ease-in-out hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-secondary'

// The field a task's name is written in, on the same box and in the same face as the dialog's title
// it replaces. In the display face itself rather than inheriting it, so the room its descenders
// need below a field that clips them comes with it, and over 16px, so iOS does not zoom into it
export const TASK_NAME_INPUT_CLASS_NAME =
  '-mx-2 box-border block w-[calc(100%+1rem)] rounded-xs border-0 bg-white px-2 py-1 font-heading text-2xl/[1.15] font-normal text-secondary shadow-[inset_0_0_0_1px_var(--color-secondary)] outline-none placeholder:text-neutral-400 aria-invalid:shadow-[inset_0_0_0_1px_var(--color-danger)]'
