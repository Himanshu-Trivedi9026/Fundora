import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ProjectCard from "../components/ProjectCard";
import { supabase } from "../lib/supabaseClient";

export default function Saved() {
  const [projects, setProjects] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [creatorMap, setCreatorMap] = useState({});

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id || null;
      setCurrentUserId(uid);

      const savedIds = JSON.parse(
        localStorage.getItem("savedProjects") || "[]",
      );

      if (savedIds.length === 0) return setProjects([]);

      const { data } = await supabase
        .from("projects")
        .select("*")
        .in("id", savedIds);

      const projectList = data || [];
      setProjects(projectList);

      // Batch-fetch creator names
      const ownerIds = [
        ...new Set(projectList.map((p) => p.owner_id).filter(Boolean)),
      ];
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", ownerIds);

        const map = {};
        (profiles || []).forEach((p) => {
          map[p.id] = p.full_name;
        });
        setCreatorMap(map);
      }
    }
    load();
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-extrabold text-white mb-4">
          Saved Projects
        </h1>

        {projects.length === 0 ? (
          <p className="text-slate-400" role="status">
            No saved projects yet.
          </p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                currentUserId={currentUserId}
                creatorName={creatorMap[p.owner_id]}
              />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
