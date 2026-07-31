import React from 'react';

/**
 * Discrete rating slider for survey questions.
 * Supports integer steps between min and max with a draggable track and optional step shortcuts.
 */
export default function RatingSlider({ min = 1, max = 5, value, onChange, disabled = false }) {
  const hasValue = value != null;
  const sliderValue = hasValue ? value : min;
  const fillPercent = max === min ? 100 : ((sliderValue - min) / (max - min)) * 100;
  const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const showStepShortcuts = steps.length <= 10;

  return (
    <div className={`survey-rating-slider ${disabled ? 'survey-rating-slider--disabled' : ''}`}>
      <div className="flex justify-center mb-4">
        <div
          className={`flex items-center justify-center w-16 h-16 rounded-full text-2xl font-bold transition-all duration-200 ${
            hasValue
              ? 'bg-[#2afeae] text-[#1b365d] shadow-md'
              : 'bg-gray-50 text-gray-400 border-2 border-dashed border-gray-300'
          }`}
        >
          {hasValue ? value : '—'}
        </div>
      </div>

      {!hasValue && !disabled && (
        <p className="text-center text-sm text-gray-500 mb-4">Drag the slider to select a rating</p>
      )}

      <div className="relative px-1 pt-2 pb-1">
        <div
          className="pointer-events-none absolute left-1 right-1 top-1/2 -translate-y-1/2 h-2 rounded-full bg-gray-200 overflow-hidden"
          aria-hidden="true"
        >
          <div
            className="h-full rounded-full bg-[#2afeae] transition-all duration-150"
            style={{ width: `${fillPercent}%` }}
          />
        </div>

        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={sliderValue}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          disabled={disabled}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={hasValue ? value : undefined}
          aria-label="Rating"
          className="survey-rating-slider__input relative z-10 w-full"
        />
      </div>

      <div className="flex justify-between text-sm font-medium text-gray-500 px-1 mt-1">
        <span>{min}</span>
        <span>{max}</span>
      </div>

      {showStepShortcuts && (
        <div className="mt-4 grid gap-1" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
          {steps.map((step) => (
            <button
              key={step}
              type="button"
              onClick={() => !disabled && onChange(step)}
              disabled={disabled}
              className={`min-w-0 rounded-md py-1.5 text-xs font-medium transition-colors ${
                value === step
                  ? 'bg-[#2afeae] text-[#1b365d] shadow-sm'
                  : disabled
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
              }`}
              aria-label={`Rate ${step}`}
              aria-pressed={value === step}
            >
              {step}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
