import { Badge } from "./ui";

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
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Project categories"
      >
        {categories.map((cat) => (
          <Badge
            key={cat}
            active={selected.includes(cat)}
            onClick={() => toggleCategory(cat)}
            aria-pressed={selected.includes(cat)}
          >
            {cat}
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
