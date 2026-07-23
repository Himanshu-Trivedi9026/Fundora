import { forwardRef } from "react";

const Textarea = forwardRef(function Textarea(
  {
    label,
    error,
    hint,
    className = "",
    id,
    rows = 4,
    ...props
  },
  ref
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

      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        className={`w-full bg-surface-container-lowest border rounded-lg p-4 text-on-surface font-inter text-sm outline-none transition-all resize-none placeholder:text-on-surface-variant/30 ${
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

export default Textarea;
