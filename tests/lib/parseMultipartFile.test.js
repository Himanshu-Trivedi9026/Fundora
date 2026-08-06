import { describe, it, expect } from "vitest";
import { Readable } from "node:stream";
import { parseMultipartFile } from "../../lib/api/parseMultipartFile";

const BOUNDARY = "----FormBoundaryFundora1234";

/**
 * Build a multipart/form-data body as a Buffer (fields may repeat).
 * Values for files can be strings or Buffers so binary content survives.
 */
function buildMultipart({ fields = {}, files = [] }) {
  const chunks = [];
  const line = (s) => chunks.push(Buffer.from(`${s}\r\n`));

  for (const [name, value] of Object.entries(fields)) {
    const values = Array.isArray(value) ? value : [value];
    for (const v of values) {
      line(`--${BOUNDARY}`);
      line(`Content-Disposition: form-data; name="${name}"`);
      line("");
      line(v);
    }
  }

  for (const { fieldName, filename, contentType, content } of files) {
    line(`--${BOUNDARY}`);
    line(
      `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"`,
    );
    line(`Content-Type: ${contentType}`);
    line("");
    if (Buffer.isBuffer(content)) {
      chunks.push(content);
      chunks.push(Buffer.from("\r\n"));
    } else {
      line(content);
    }
  }

  line(`--${BOUNDARY}--`);
  line("");
  return Buffer.concat(chunks);
}

function makeReq(bodyBuffer) {
  const stream = Readable.from([bodyBuffer]);
  stream.headers = {
    "content-type": `multipart/form-data; boundary=${BOUNDARY}`,
  };
  return stream;
}

describe("lib/api/parseMultipartFile", () => {
  it("parses text fields and a file into { fields, files }", async () => {
    const body = buildMultipart({
      fields: { documentType: "pan_card" },
      files: [
        {
          fieldName: "file",
          filename: "pan.jpg",
          contentType: "image/jpeg",
          content: "fake-jpeg-bytes",
        },
      ],
    });

    const { fields, files } = await parseMultipartFile(makeReq(body));

    expect(fields.documentType).toBe("pan_card");
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({
      fieldName: "file",
      originalFilename: "pan.jpg",
      mimeType: "image/jpeg",
      size: "fake-jpeg-bytes".length,
    });
    // Buffer contains the exact uploaded bytes.
    expect(Buffer.isBuffer(files[0].buffer)).toBe(true);
    expect(files[0].buffer.toString()).toBe("fake-jpeg-bytes");
  });

  it("coalesces repeated fields into arrays", async () => {
    const body = buildMultipart({
      fields: { tag: ["a", "b"] },
      files: [],
    });

    const { fields, files } = await parseMultipartFile(makeReq(body));
    expect(fields.tag).toEqual(["a", "b"]);
    expect(files).toHaveLength(0);
  });

  it("handles a request with no files", async () => {
    const body = buildMultipart({
      fields: { documentType: "selfie" },
      files: [],
    });

    const { fields, files } = await parseMultipartFile(makeReq(body));
    expect(fields.documentType).toBe("selfie");
    expect(files).toHaveLength(0);
  });

  it("parses a binary file without corrupting it", async () => {
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    const body = buildMultipart({
      fields: {},
      files: [
        {
          fieldName: "file",
          filename: "photo.png",
          contentType: "image/png",
          content: bytes,
        },
      ],
    });

    const { files } = await parseMultipartFile(makeReq(body));
    expect(files[0].buffer.equals(bytes)).toBe(true);
    expect(files[0].size).toBe(bytes.length);
  });

  it("rejects when the body is not multipart", async () => {
    const req = makeReq("not a multipart body");
    req.headers = { "content-type": "text/plain" };
    await expect(parseMultipartFile(req)).rejects.toBeTruthy();
  });
});
