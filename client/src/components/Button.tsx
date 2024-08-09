import { type VariantProps, cva } from "class-variance-authority"
import * as React from "react"
import { cn } from "../utils/ui"
import { Loading } from "./Loading"
import { Tooltip } from "./Tooltip"

export const buttonVariants = cva(
  "inline-flex text-anchor hover:text-white hover:bg-anchor items-center rounded-md justify-center text-sm ring-offset-anchor transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        icon: "svg-container border border-anchor rounded-sm",
        iconMeta: "svg-container rounded-sm",
      },
      size: {
        icon: "p-[0.1em]",
      },
    },
    defaultVariants: {
      variant: "icon",
      size: "icon",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  inProgress?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { children, className, variant, size, inProgress = false, title, ...props },
    ref,
  ) => {
    const content = React.useMemo(
      () => (inProgress ? <Loading className="w-4 h-4" /> : children),
      [inProgress, children],
    )

    const btn = (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {content}
      </button>
    )

    if (title) {
      return <Tooltip triggerContent={btn}>{title}</Tooltip>
    } else {
      return btn
    }
  },
)
