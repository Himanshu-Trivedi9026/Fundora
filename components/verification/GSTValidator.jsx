import { useState } from "react";

/**
 * GSTValidator — GST input with live validation.
 *
 * @param {Object} props
 * @param {string} props.value — GST number
 * @param {Function} props.onChange — Callback with validated value
 * @param {Function} props.onSubmit — Callback to submit for verification
 * @param {string} props.status — Current verification status
 * @param {boolean} props.loading — Loading state
 */
export default function GSTValidator({ value = "", onChange, onSubmit, status, loading = false }) {
  const [error, setError] = useState("");

  const validate = (gst) => {
    if (!gst) { setError(""); return true; }
    const cleaned = gst.trim().toUpperCase();
    if (cleaned.length > 0 && cleaned.length !== 15) {
      setError("GST must be 15 characters");
      return false;
    }
    if (cleaned.length === 15) {
      const gstRegex = /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$/;
      if (!gstRegex.test(cleaned)) {
        setError("Invalid GST format");
        return false;
      }
    }
    setError("");
    return true;
  };

  const handleChange = (e) => {
    const val = e.target.value.toUpperCase().slice(0, 15);
    onChange(val);
    validate(val);
  };

  return (
    <div className="space-y-2">
      <label className="text-xs text-on-surface-variant font-inter block">GST Number</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={handleChange}
          maxLength={15}
          disabled={status === "verified"}
          className={`flex-1 px-3 py-2 rounded-xl bg-surface-container-high/50 border text-sm font-inter text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary transition-colors ${
            error ? "border-danger" : "border-white/10"
          } ${status === "verified" ? "opacity-50" : ""}`}
          placeholder="22AAAAA0000A1Z5"
        />
        {onSubmit && status !== "verified" && (
          <button
            type="button"
            onClick={() => onSubmit(value)}
            disabled={loading || !value || !!error}
            className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-inter font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? "..." : "Verify"}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      {status === "verified" && (
        <p className="text-xs text-success font-inter flex items-center gap-1">
          <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          GST verified
        </p>
      )}
    </div>
  );
}
