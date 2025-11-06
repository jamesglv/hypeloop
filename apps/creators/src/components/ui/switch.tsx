import { useState } from 'react'

interface SwitchProps {
  defaultChecked?: boolean
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  className?: string
  disabled?: boolean
}

export function Switch({ 
  defaultChecked = false, 
  checked: controlledChecked,
  onCheckedChange,
  className = '',
  disabled = false
}: SwitchProps) {
  const [internalChecked, setInternalChecked] = useState(defaultChecked)
  const isControlled = controlledChecked !== undefined
  const checked = isControlled ? controlledChecked : internalChecked

  const handleClick = () => {
    if (disabled) return
    
    const newChecked = !checked
    if (!isControlled) {
      setInternalChecked(newChecked)
    }
    onCheckedChange?.(newChecked)
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={handleClick}
      disabled={disabled}
      className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7A5FFF] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked 
          ? 'bg-[#7A5FFF]' 
          : 'bg-gray-200'
      } ${className}`}
    >
      <span
        className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

