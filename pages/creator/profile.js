// pages/creator/profile.js
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";
import { uploadCreatorFile } from "../../lib/uploadCreatorFile";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";

export default function CreatorProfile() {
  const router = useRouter();

  const [creator, setCreator] = useState(null);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");

  const [photo, setPhoto] = useState(null);
  const [qr, setQr] = useState(null);

  const [photoPreview, setPhotoPreview] = useState(null);
  const [qrPreview, setQrPreview] = useState(null);

  useEffect(() => {
    loadProfile();
  }, []);

  // Clean up blob URLs when values change or component unmounts
  useEffect(() => {
    return () => { if (photoPreview) URL.revokeObjectURL(photoPreview); };
  }, [photoPreview]);

  useEffect(() => {
    return () => { if (qrPreview) URL.revokeObjectURL(qrPreview); };
  }, [qrPreview]);

  async function loadProfile() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return;

    const { data } = await supabase
      .from("creators")
      .select("*")
      .eq("user_id", auth.user.id)
      .single();

    if (data) {
      setCreator(data);
      setName(data.name || "");
      setAge(data.age || "");
      setEmail(data.email || "");
      setMobile(data.mobile || "");

      if (data.photo) setPhotoPreview(data.photo);
      if (data.upi_qr) setQrPreview(data.upi_qr);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setLoading(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    let photoUrl = creator?.photo || null;
    let qrUrl = creator?.upi_qr || null;

    if (photo) {
      photoUrl = await uploadCreatorFile(photo, "creator-photos", user.id);
    }

    if (qr) {
      qrUrl = await uploadCreatorFile(qr, "creator-qr", user.id);
    }

    const payload = {
      user_id: user.id,
      name,
      age: age ? Number(age) : null,
      email,
      mobile,
      photo: photoUrl,
      upi_qr: qrUrl,
    };

    if (creator) {
      await supabase.from("creators").update(payload).eq("id", creator.id);
    } else {
      await supabase.from("creators").insert(payload);
    }

    alert("Profile saved successfully");
    await loadProfile();
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-900">
      <Navbar />

      <main className="flex-1 flex justify-center items-start py-10">
        <div className="w-full max-w-xl">
          <h1 className="text-2xl font-bold text-white mb-4">
            Creator Profile
          </h1>

          <form
            onSubmit={handleSave}
            className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-8"
          >
            <input
              className="input"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <input
              className="input"
              type="number"
              placeholder="Age"
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />

            <input
              className="input"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              className="input"
              placeholder="Mobile"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
            />

            {/* PROFILE PHOTO */}
            <div>
              <label className="block text-sm text-slate-300 mb-1">
                Profile Photo
              </label>

              {photoPreview && (
                <img
                  src={photoPreview}
                  className="w-24 h-24 rounded-full object-cover mb-2 border"
                  alt="Profile"
                />
              )}

              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (!file) return;

                  if (file.size > 2 * 1024 * 1024) {
                    alert("Profile photo must be under 2MB");
                    return;
                  }

                  if (photoPreview) URL.revokeObjectURL(photoPreview);
                  setPhoto(file);
                  setPhotoPreview(URL.createObjectURL(file));
                }}
                className="block w-full text-sm text-slate-300
                           file:mr-4 file:py-2 file:px-4
                           file:rounded-md file:border-0
                           file:text-sm file:font-semibold
                           file:bg-blue-600 file:text-white
                           hover:file:bg-blue-500 cursor-pointer"
              />
            </div>

            {/* UPI QR */}
            <div>
              <label className="block text-sm text-slate-300 mb-1">
                UPI QR Code
              </label>

              {qrPreview && (
                <img
                  src={qrPreview}
                  className="w-40 rounded border mb-2"
                  alt="UPI QR"
                />
              )}

              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  if (qrPreview) URL.revokeObjectURL(qrPreview);
                  setQr(file);
                  setQrPreview(URL.createObjectURL(file));
                }}
                className="block w-full text-sm text-slate-300
                           file:mr-4 file:py-2 file:px-4
                           file:rounded-md file:border-0
                           file:text-sm file:font-semibold
                           file:bg-blue-600 file:text-white
                           hover:file:bg-blue-500 cursor-pointer"
              />
            </div>

            <button className="btn-primary w-full" disabled={loading}>
              {loading ? "Saving..." : "Save Profile"}
            </button>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  );
}
