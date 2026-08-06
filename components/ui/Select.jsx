import { forwardRef } from "react";

const Select = forwardRef(function Select(
  {
    label,
    error,
    hint,
    options = [],
    placeholder = "Select an option",
    className = "",
    id,
    ...props
  },
  ref,
) {
  const inputId = id || props.name || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block font-inter text-sm text-on-surface-variant"
        >
          {label}
          {props.required && <span className="text-danger ml-0.5">*</span>}
        </label>
      )}

      <div className="relative">
        <select
          ref={ref}
          id={inputId}
          className={`w-full bg-surface-container-lowest border rounded-lg p-3.5 pr-10 text-on-surface font-inter text-sm outline-none transition-all appearance-none cursor-pointer ${
            error
              ? "border-danger/50 focus:border-danger focus:ring-1 focus:ring-danger/20"
              : "border-white/[0.08] focus:border-primary focus:ring-1 focus:ring-primary/20 hover:border-white/[0.12]"
          } ${className}`}
          aria-invalid={!!error}
          aria-describedby={
            error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
          }
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) =>
            typeof opt === "string" ? (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ) : (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ),
          )}
        </select>

        {/* Chevron icon */}
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">
          <span className="material-symbols-outlined text-[18px]">
            expand_more
          </span>
        </span>
      </div>

      {error && (
        <p
          id={`${inputId}-error`}
          className="text-danger text-xs font-inter"
          role="alert"
        >
          {error}
        </p>
      )}

      {hint && !error && (
        <p
          id={`${inputId}-hint`}
          className="text-on-surface-variant/40 text-xs font-inter"
        >
          {hint}
        </p>
      )}
    </div>
  );
});

export default Select;
