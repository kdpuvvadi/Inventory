import { cn } from '@/lib/utils'
import { parseSerialList } from '@/services/serials'

import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface SerialNumbersInputProps {
  value: string
  onChange: (value: string) => void
  expectedQuantity?: number
  disabled?: boolean
  className?: string
}

export function SerialNumbersInput({
  value,
  onChange,
  expectedQuantity,
  disabled,
  className,
}: SerialNumbersInputProps) {
  const count = parseSerialList(value).length
  const matches = expectedQuantity === undefined || count === expectedQuantity

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <Label>Serial Numbers</Label>
        <span
          className={cn(
            'text-sm',
            matches ? 'text-muted-foreground' : 'text-amber-600 dark:text-amber-400',
          )}
        >
          {expectedQuantity !== undefined
            ? `${count} / ${expectedQuantity} serials entered`
            : `${count} serial${count === 1 ? '' : 's'} entered`}
        </span>
      </div>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Enter one serial number per line or comma-separated"
        rows={6}
        disabled={disabled}
      />
      <p className="text-xs text-muted-foreground">
        Paste serial numbers separated by new lines or commas.
      </p>
    </div>
  )
}
