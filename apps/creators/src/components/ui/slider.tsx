import { useState, useRef, useEffect, useCallback } from 'react'

interface SliderProps {
  defaultValue?: number[]
  value?: number[]
  min?: number
  max?: number
  className?: string
  onChange?: (value: number[]) => void
}

export function Slider({ 
  defaultValue = [50], 
  value,
  min = 0, 
  max = 100,
  className = '',
  onChange 
}: SliderProps) {
  const [sliderValue, setSliderValue] = useState<number[]>(value || defaultValue)
  const [isDragging, setIsDragging] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (value !== undefined) {
      setSliderValue(value)
    }
  }, [value])

  const updateValue = (e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
    if (!trackRef.current) return

    const rect = trackRef.current.getBoundingClientRect()
    const x = 'clientX' in e ? e.clientX - rect.left : (e as MouseEvent).clientX - rect.left
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))
    const newValue = Math.round((percentage / 100) * (max - min) + min)
    
    const newValues = [newValue]
    setSliderValue(newValues)
    onChange?.(newValues)
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true)
    updateValue(e)
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging && trackRef.current) {
      updateValue(e)
    }
  }, [isDragging])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  const percentage = ((sliderValue[0] - min) / (max - min)) * 100

  return (
    <div
      ref={trackRef}
      className={`relative flex w-full touch-none items-center select-none h-4 ${className}`}
      onMouseDown={handleMouseDown}
    >
      <div className="bg-muted relative grow overflow-hidden rounded-full h-1.5 w-full">
        <div
          className="bg-primary absolute h-full rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div
        className="absolute border-primary bg-background ring-ring/50 block size-4 shrink-0 rounded-full border shadow-sm cursor-pointer hover:ring-4 focus-visible:ring-4 transition-all"
        style={{ left: `calc(${percentage}% - 8px)` }}
      />
    </div>
  )
}

