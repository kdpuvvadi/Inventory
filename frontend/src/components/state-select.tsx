import { FormControl } from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { INDIAN_STATES } from '@/utils/constants'

interface StateSelectProps {
  value?: string
  onChange: (value: string) => void
  onBlur?: () => void
  disabled?: boolean
  placeholder?: string
  id?: string
  /** When true, wraps the trigger in FormControl for react-hook-form. */
  withFormControl?: boolean
}

export function StateSelect({
  value,
  onChange,
  onBlur,
  disabled,
  placeholder = 'Select state',
  id,
  withFormControl = true,
}: StateSelectProps) {
  const current = value?.trim() || ''
  const known = INDIAN_STATES.some((state) => state.value === current)
  const options =
    current && !known
      ? [{ value: current, label: current }, ...INDIAN_STATES]
      : INDIAN_STATES

  const trigger = (
    <SelectTrigger id={id} onBlur={onBlur}>
      <SelectValue placeholder={placeholder} />
    </SelectTrigger>
  )

  return (
    <Select
      value={current || undefined}
      onValueChange={onChange}
      disabled={disabled}
    >
      {withFormControl ? <FormControl>{trigger}</FormControl> : trigger}
      <SelectContent>
        {options.map((state) => (
          <SelectItem key={state.value} value={state.value}>
            {state.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
