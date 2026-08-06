/**
 * parseMultipartFile — Parse a multipart/form-data request body.
 *
 * Server-side helper for API routes that receive file uploads. Reads the
 * request stream with busboy and collects text fields and file parts into a
 * plain object, so route handlers never touch busboy directly.
 *
 * Usage (in a route using this helper):
 *   import { parseMultipartFile } from "../../../lib/api/parseMultipartFile";
 *
 *   export const config = { api: { bodyParser: false } };
 *   export default withAuth(async function handler(req, res, user) {
 *     const { fields, files } = await parseMultipartFile(req);
 *     ...
 *   });
 *
 * Each file part is returned as:
 *   { fieldName, originalFilename, mimeType, buffer, size }
 *
 * The buffer is a Node Buffer so it can be passed directly to
 * supabaseAdmin.storage.upload() and to validateCorruption() (a Uint8Array).
 */

import Busboy from "busboy";

const MAX_FIELD_SIZE = 1024 * 1024; // 1MB per text field
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB per file (route-level limit is 10MB)

/**
 * Parse a multipart request into fields and files.
 *
 * @param {import("http").IncomingMessage} req — The Next.js API request
 * @returns {Promise<{ fields: Object<string,string>, files: Array<Object> }>}
 */
export function parseMultipartFile(req) {
  return new Promise((resolve, reject) => {
    const fields = {};
    const files = [];

    const busboy = Busboy({
      headers: req.headers,
      limits: {
        fieldSize: MAX_FIELD_SIZE,
        fileSize: MAX_FILE_SIZE,
        files: 10,
      },
    });

    busboy.on("field", (name, value) => {
      // Coalesce repeated fields into arrays (e.g. multiple documentTypes).
      if (Object.prototype.hasOwnProperty.call(fields, name)) {
        if (Array.isArray(fields[name])) {
          fields[name].push(value);
        } else {
          fields[name] = [fields[name], value];
        }
      } else {
        fields[name] = value;
      }
    });

    busboy.on("file", (fieldName, stream, info) => {
      const { filename, mimeType } = info;
      const chunks = [];
      let size = 0;

      stream.on("data", (chunk) => {
        chunks.push(chunk);
        size += chunk.length;
      });

      stream.on("limit", () => {
        stream.unpipe();
        stream.resume();
      });

      stream.on("error", (err) => {
        reject(err);
      });

      stream.on("end", () => {
        files.push({
          fieldName,
          originalFilename: filename || null,
          mimeType: mimeType || null,
          buffer: Buffer.concat(chunks),
          size,
        });
      });
    });

    busboy.on("error", (err) => {
      reject(err);
    });

    busboy.on("finish", () => {
      resolve({ fields, files });
    });

    req.pipe(busboy);
  });
}
