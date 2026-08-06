import { useState } from "react";

/**
 * BankAccountForm — Add/edit bank account form.
 *
 * @param {Object} props
 * @param {Function} props.onSubmit — Callback with form data
 * @param {Object} props.initialData — Initial form data for editing
 * @param {boolean} props.loading — Loading state
 */
export default function BankAccountForm({
  onSubmit,
  initialData = {},
  loading = false,
}) {
  const [form, setForm] = useState({
    accountHolderName: initialData.accountHolderName || "",
    accountNumber: initialData.accountNumber || "",
    ifscCode: initialData.ifscCode || "",
    bankName: initialData.bankName || "",
    branchName: initialData.branchName || "",
    accountType: initialData.accountType || "savings",
    upiId: initialData.upiId || "",
  });

  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!form.accountHolderName.trim())
      errs.accountHolderName = "Account holder name is required";
    if (!form.accountNumber.trim())
      errs.accountNumber = "Account number is required";
    else if (form.accountNumber.replace(/\s/g, "").length < 9)
      errs.accountNumber = "Invalid account number";
    if (!form.ifscCode.trim()) errs.ifscCode = "IFSC code is required";
    else if (form.ifscCode.trim().length !== 11)
      errs.ifscCode = "IFSC must be 11 characters";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onSubmit({
        ...form,
        accountNumber: form.accountNumber.replace(/\s/g, ""),
        ifscCode: form.ifscCode.trim().toUpperCase(),
      });
    }
  };

  const update = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs text-on-surface-variant font-inter mb-1 block">
          Account Holder Name *
        </label>
        <input
          type="text"
          value={form.accountHolderName}
          onChange={(e) => update("accountHolderName", e.target.value)}
          className={`w-full px-3 py-2 rounded-xl bg-surface-container-high/50 border text-sm font-inter text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary transition-colors ${
            errors.accountHolderName ? "border-danger" : "border-white/10"
          }`}
          placeholder="Enter account holder name"
        />
        {errors.accountHolderName && (
          <p className="text-xs text-danger mt-1">{errors.accountHolderName}</p>
        )}
      </div>

      <div>
        <label className="text-xs text-on-surface-variant font-inter mb-1 block">
          Account Number *
        </label>
        <input
          type="text"
          value={form.accountNumber}
          onChange={(e) => update("accountNumber", e.target.value)}
          className={`w-full px-3 py-2 rounded-xl bg-surface-container-high/50 border text-sm font-inter text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary transition-colors ${
            errors.accountNumber ? "border-danger" : "border-white/10"
          }`}
          placeholder="Enter account number"
        />
        {errors.accountNumber && (
          <p className="text-xs text-danger mt-1">{errors.accountNumber}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-on-surface-variant font-inter mb-1 block">
            IFSC Code *
          </label>
          <input
            type="text"
            value={form.ifscCode}
            onChange={(e) => update("ifscCode", e.target.value.toUpperCase())}
            maxLength={11}
            className={`w-full px-3 py-2 rounded-xl bg-surface-container-high/50 border text-sm font-inter text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary transition-colors ${
              errors.ifscCode ? "border-danger" : "border-white/10"
            }`}
            placeholder="ABCD0123456"
          />
          {errors.ifscCode && (
            <p className="text-xs text-danger mt-1">{errors.ifscCode}</p>
          )}
        </div>
        <div>
          <label className="text-xs text-on-surface-variant font-inter mb-1 block">
            Account Type
          </label>
          <select
            value={form.accountType}
            onChange={(e) => update("accountType", e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-surface-container-high/50 border border-white/10 text-sm font-inter text-on-surface focus:outline-none focus:border-primary transition-colors"
          >
            <option value="savings">Savings</option>
            <option value="current">Current</option>
            <option value="salary">Salary</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-on-surface-variant font-inter mb-1 block">
            Bank Name
          </label>
          <input
            type="text"
            value={form.bankName}
            onChange={(e) => update("bankName", e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-surface-container-high/50 border border-white/10 text-sm font-inter text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary transition-colors"
            placeholder="Bank name"
          />
        </div>
        <div>
          <label className="text-xs text-on-surface-variant font-inter mb-1 block">
            Branch Name
          </label>
          <input
            type="text"
            value={form.branchName}
            onChange={(e) => update("branchName", e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-surface-container-high/50 border border-white/10 text-sm font-inter text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary transition-colors"
            placeholder="Branch name"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-on-surface-variant font-inter mb-1 block">
          UPI ID (optional)
        </label>
        <input
          type="text"
          value={form.upiId}
          onChange={(e) => update("upiId", e.target.value)}
          className="w-full px-3 py-2 rounded-xl bg-surface-container-high/50 border border-white/10 text-sm font-inter text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary transition-colors"
          placeholder="name@bank"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 px-4 rounded-xl bg-primary text-on-primary text-sm font-inter font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading
          ? "Saving..."
          : initialData.accountHolderName
            ? "Update Account"
            : "Add Account"}
      </button>
    </form>
  );
}
