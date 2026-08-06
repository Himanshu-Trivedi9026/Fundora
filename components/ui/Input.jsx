import { forwardRef } from "react";

const Input = forwardRef(function Input(
  { label, error, hint, prefix, className = "", id, ...props },
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
        {prefix && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-inter text-sm pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full bg-surface-container-lowest border rounded-lg text-on-surface font-inter text-sm outline-none transition-all placeholder:text-on-surface-variant/30 ${
            prefix ? "pl-8" : "pl-4"
          } pr-4 py-3.5 ${
            error
              ? "border-danger/50 focus:border-danger focus:ring-1 focus:ring-danger/20"
              : "border-white/[0.08] focus:border-primary focus:ring-1 focus:ring-primary/20 hover:border-white/[0.12]"
          } ${className}`}
          aria-invalid={!!error}
          aria-describedby={
            error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
          }
          {...props}
        />
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

export default Input;
