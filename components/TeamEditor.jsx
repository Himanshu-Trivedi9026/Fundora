import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Input, Button } from "./ui";

export default function TeamEditor({ team, setTeam }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");

  function addMember() {
    if (!name.trim()) return;
    setTeam([...team, { name, role }]);
    setName("");
    setRole("");
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      addMember();
    }
  }

  function removeMember(index) {
    setTeam(team.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4">
      {/* Add Member Form */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="Name"
          aria-label="Team member name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Input
          placeholder="Role"
          aria-label="Team member role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button
          variant="primary"
          onClick={addMember}
          aria-label="Add team member"
        >
          Add
        </Button>
      </div>

      {/* Team Members List */}
      <AnimatePresence mode="popLayout">
        {team.map((m, idx) => (
          <div
            key={`${m.name}-${idx}`}
            className="flex justify-between items-center bg-surface-container-low p-3 rounded-lg border border-outline-variant/50"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                person
              </span>
              <div>
                <span className="text-sm text-on-surface font-inter font-medium">
                  {m.name}
                </span>
                {m.role && (
                  <span className="text-xs text-on-surface-variant font-inter ml-2">
                    — {m.role}
                  </span>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeMember(idx)}
              aria-label={`Remove ${m.name}`}
            >
              <span className="material-symbols-outlined text-[16px]">
                close
              </span>
            </Button>
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
