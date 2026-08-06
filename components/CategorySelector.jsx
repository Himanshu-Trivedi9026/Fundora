import { Badge } from "./ui";
import { PROJECT_CATEGORIES } from "../lib/categories";

export default function CategorySelector({ selected, setSelected }) {
  function toggleCategory(cat) {
    if (selected.includes(cat)) {
      setSelected(selected.filter((c) => c !== cat));
    } else {
      setSelected([...selected, cat]);
    }
  }

  return (
    <div className="space-y-2">
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Project categories"
      >
        {PROJECT_CATEGORIES.map((cat) => (
          <Badge
            key={cat.id}
            active={selected.includes(cat.label)}
            onClick={() => toggleCategory(cat.label)}
            aria-pressed={selected.includes(cat.label)}
          >
            {cat.label}
          </Badge>
        ))}
      </div>

      {selected.length > 0 && (
        <p className="text-[11px] text-on-surface-variant/60 font-inter mt-1">
          Selected: {selected.join(", ")}
        </p>
      )}
    </div>
  );
}
