// components/MediaUploader.jsx
import { useCallback } from "react";
import { useDropzone } from "react-dropzone";

export default function MediaUploader({ mediaFiles, setMediaFiles }) {
  
  const onDrop = useCallback(
    (acceptedFiles) => {
      setMediaFiles([...mediaFiles, ...acceptedFiles]);
    },
    [mediaFiles, setMediaFiles]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
  });

  return (
    <div>
      <label htmlFor="media-upload" className="text-sm text-slate-300">Upload Media</label>

      <div
        {...getRootProps()}
        className="mt-2 border border-slate-700 rounded-lg p-6 bg-slate-800 cursor-pointer"
      >
        <input id="media-upload" {...getInputProps()} />

        {isDragActive ? (
          <p className="text-slate-300 text-sm">Drop files here...</p>
        ) : (
          <p className="text-slate-500 text-sm">
            Drag & drop images, videos, or documents — or click to browse
          </p>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        {mediaFiles.map((file, idx) => (
          <div
            key={idx}
            className="p-2 rounded bg-slate-700 text-xs text-slate-200 overflow-hidden"
          >
            {file.name}
          </div>
        ))}
      </div>
    </div>
  );
}
