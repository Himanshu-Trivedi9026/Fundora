// components/TeamEditor.jsx
import { useState } from "react";

export default function TeamEditor({ team, setTeam }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");

  function addMember() {
    if (!name.trim()) return;
    setTeam([...team, { name, role }]);
    setName("");
    setRole("");
  }

  function removeMember(index) {
    setTeam(team.filter((_, i) => i !== index));
  }

  return (
    <div>
      <label className="text-sm text-slate-300">Team Members</label>

      <div className="mt-2 flex gap-2">
        <input
          placeholder="Name"
          aria-label="Team member name"
          className="flex-1 p-2 rounded bg-slate-800 text-slate-100 border border-slate-700"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          placeholder="Role"
          aria-label="Team member role"
          className="flex-1 p-2 rounded bg-slate-800 text-slate-100 border border-slate-700"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        />
        <button
          onClick={addMember}
          aria-label="Add team member"
          className="px-3 rounded bg-blue-600 text-white text-sm"
        >
          Add
        </button>
      </div>

      <ul className="mt-3 space-y-2">
        {team.map((m, idx) => (
          <li
            key={idx}
            className="flex justify-between items-center bg-slate-800 p-2 rounded border border-slate-700"
          >
            <span className="text-sm text-slate-200">
              {m.name} — {m.role}
            </span>
            <button
              onClick={() => removeMember(idx)}
              className="text-xs text-red-400"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
