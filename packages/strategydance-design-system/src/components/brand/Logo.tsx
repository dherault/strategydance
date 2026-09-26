import type { ComponentProps } from 'react'

type Props = ComponentProps<'svg'> & {
  /** The accessible name. Without one the mark is decorative */
  title?: string
}

/*
  The Strategy Dance mark, filled with the text colour: secondary or black on a light surface,
  white on primary, and never recoloured outside the brand's. The viewBox is cropped to the
  mark, so its width is the mark's own
*/
function Logo({ title, ...props }: Props) {
  return (
    <svg
      data-slot="logo"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="26 39 303 307"
      fill="currentColor"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      {...props}
    >
      <path
        fillRule="evenodd"
        d="M254.86 114.75A118.3 118.3 0 1 0 94.11 265.01A12.88 12.88 0 0 1 100.51 271.78A118.21 118.21 0 1 0 259.64 119.83A9.39 9.39 0 0 1 254.86 114.75ZM232.38 151.07A87.87 87.87 0 0 1 132.78 245.17A12 12 0 0 1 122.46 234.26A87.78 87.78 0 0 1 222.07 140.15A12 12 0 0 1 232.38 151.07ZM209.73 98.92A87.87 87.87 0 0 0 57.09 152.62A25.3 25.3 0 0 0 103.68 167.79A120.23 120.23 0 0 1 203.96 112.15A7.9 7.9 0 0 0 209.73 98.92ZM143.91 284.92A87.78 87.78 0 0 0 297.39 234.79A26.16 26.16 0 0 0 249.27 218.44A121.35 121.35 0 0 1 148.52 274.57A6.24 6.24 0 0 0 143.91 284.92Z"
      />
    </svg>
  )
}

export { Logo }
