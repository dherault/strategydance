/*
  The box a task's text and a list's name share with the field that edits them: a 1px border, 8px
  either side, the xs radius, and pulled 9px left so the text starts where the column does. The
  text's border is transparent and the field's shows, so clicking one into the other changes their
  colors and nothing else: the words stay where they were
*/
export const EDITABLE_BOX_CLASS_NAME = '-ml-[9px] rounded-xs border px-2'

/*
  What the buttons that appear on hover fade with. The design system's button transitions its
  colors alone, which would make them blink in, so their opacity joins those
*/
export const REVEALED_TRANSITION_CLASS_NAME = 'transition-[opacity,color,background-color] duration-150 ease-in-out'
