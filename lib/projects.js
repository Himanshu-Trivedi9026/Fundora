// lib/projects.js
import { supabase } from "./supabaseClient";

// NOTE: campaign creation is intentionally NOT here anymore. Publishing now
// goes through the single verified-only path: POST /api/projects (wrapped in
// withVerified), backed by the migration-020 BEFORE INSERT trigger. Keep the
// direct client insert out of this file so it can't be resurrected as a bypass.

/* -----------------------------
   UPDATE PROJECT
-------------------------------- */
export async function updateProject(id, updateData) {
  const { data, error } = await supabase
    .from("projects")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/* -----------------------------
   DELETE PROJECT
-------------------------------- */
export async function deleteProject(id) {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
  return true;
}
