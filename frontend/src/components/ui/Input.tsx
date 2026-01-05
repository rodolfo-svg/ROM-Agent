import { forwardRef, InputHTMLAttributes } from 'react'
import { cn } from '@/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string
  icon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, icon, ...props }, ref) => {
    return (
      <div className="relative">
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full h-12 px-4 bg-stone-100 border border-stone-200 rounded-xl',
            'text-stone-800 placeholder:text-stone-400',
            'transition-all duration-150',
            'focus:bg-white focus:border-bronze-400 focus:ring-4 focus:ring-bronze-400/10',
            'focus:outline-none',
            icon && 'pl-11',
            error && 'border-red-400 focus:border-red-400 focus:ring-red-400/10',
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-xs text-red-600">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
