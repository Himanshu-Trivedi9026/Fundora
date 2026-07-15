import { useState } from "react";

export default function CategorySelector({ selected, setSelected }) {
  const categories = [
    "Artificial Intelligence",
    "Technology",
    "Education",
    "Health",
    "Environment",
    "Food",
    "Art",
    "Fashion",
    "Gaming",
    "Community",
    "Business",
  ];

  function toggleCategory(cat) {
    if (selected.includes(cat)) {
      setSelected(selected.filter((c) => c !== cat));
    } else {
      setSelected([...selected, cat]);
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-sm text-slate-300">Project Categories</label>

      <div className="flex flex-wrap gap-2 mt-1" role="group" aria-label="Project categories">
        {categories.map((cat) => {
          const active = selected.includes(cat);

          return (
            <button
              key={cat}
              type="button"
              onClick={() => toggleCategory(cat)}
              className={`px-3 py-1 text-xs rounded-full border transition ${
                active
                  ? "bg-blue-600 text-white border-blue-500"
                  : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {selected.length > 0 && (
        <p className="text-[11px] text-slate-400 mt-1">
          Selected: {selected.join(", ")}
        </p>
      )}
    </div>
  );
}
