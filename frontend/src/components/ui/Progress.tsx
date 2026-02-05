import { forwardRef, HTMLAttributes } from 'react'
import { cn } from '@/utils'

interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value: number
}

export const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'w-full h-2 bg-stone-200 rounded-full overflow-hidden',
        className
      )}
      {...props}
    >
      <div
        className="h-full bg-stone-700 transition-all duration-300 ease-out rounded-full"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
)
Progress.displayName = 'Progress'
