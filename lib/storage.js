import { supabase } from "./supabaseClient";

export async function uploadFileToProject(file, projectId, type) {
  // Validate file exists
  if (!file) {
    throw new Error("No file provided for upload.");
  }

  // Enforce size limit for thumbnails
  if (type === "thumbnail" && file.size > 10 * 1024 * 1024) {
    throw new Error("Thumbnail file must be less than 10MB.");
  }

  // Choose bucket based on file type
  const bucketName = type === "thumbnail"
    ? "project-thumbnails"
    : "projects";

  try {
    const ext = file.name.split(".").pop();
    const filePath = `${projectId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, { upsert: false });

    if (uploadError) {
      // Provide specific error messages for common Supabase storage errors
      const msg = uploadError.message || "";
      if (msg.includes("Bucket not found") || msg.includes("not found")) {
        throw new Error(
          `Storage bucket "${bucketName}" not found. Please create it in your Supabase dashboard under Storage.`
        );
      }
      if (msg.includes("File size")) {
        throw new Error("File is too large. Maximum size is 10MB.");
      }
      if (msg.includes("mime") || msg.includes("type")) {
        throw new Error("Invalid file type. Please upload an image, video, or document.");
      }
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    const { data } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    return {
      url: data.publicUrl,
      filePath,
    };
  } catch (err) {
    console.error("Upload failed:", err);
    throw err;
  }
}
