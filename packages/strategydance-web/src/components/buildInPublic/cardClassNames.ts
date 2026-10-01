/*
  The parts every build in public card is drawn with. Their colors are the card's custom
  properties, which its tone sets (`getCardStyle`), so a part reads the same on any tone
*/

// The small uppercase line a card opens with, in the accent
export const CARD_EYEBROW_CLASS_NAME =
  'm-0 flex-none text-[11px] font-semibold tracking-wider whitespace-nowrap text-(--card-eyebrow) uppercase'

/*
  The display face, for a card's numbers and headlines. Each sets its size with its line height,
  as `text-[30px]/[1.12]`, since `cn` drops a `leading-` class that a size follows
*/
export const CARD_DISPLAY_CLASS_NAME = 'm-0 font-display font-normal tracking-tight text-balance'

/*
  A top priority on a card, set as its headline: its paragraphs in the display face, at the size
  the card gives them with a class of its own, and its lists under them in the body face, smaller
*/
export const CARD_PRIORITY_CLASS_NAME =
  'font-display font-normal tracking-tight text-balance [&_ol]:font-sans [&_ol]:text-[17px]/[1.45] [&_ol]:tracking-normal [&_ul]:font-sans [&_ul]:text-[17px]/[1.45] [&_ul]:tracking-normal'

// What reads quieter than the rest of the card
export const CARD_MUTED_CLASS_NAME = 'text-(--card-muted)'

// A hairline across the card, in its own text color
export const CARD_RULE_CLASS_NAME = 'h-px bg-current opacity-20'
