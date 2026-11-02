import { describe, expect, it } from "vitest";

import { cleanFileName, MEDIA_KIT_MAX_BYTES, validateMediaKit } from "./media-kit";

const PDF = new TextEncoder().encode("%PDF-1.7");
const NOT_PDF = new TextEncoder().encode("<html");

describe("validateMediaKit", () => {
  it("accepts a PDF with the PDF signature", () => {
    expect(validateMediaKit({ size: 1000, type: "application/pdf" }, PDF)).toEqual({ ok: true });
  });
  it("rejects a file that only claims to be a PDF", () => {
    expect(validateMediaKit({ size: 1000, type: "application/pdf" }, NOT_PDF).ok).toBe(false);
  });
  it("rejects other types, empty files and files over 4 MB", () => {
    expect(validateMediaKit({ size: 1000, type: "text/html" }, PDF).ok).toBe(false);
    expect(validateMediaKit({ size: 0, type: "application/pdf" }, PDF).ok).toBe(false);
    expect(validateMediaKit({ size: MEDIA_KIT_MAX_BYTES + 1, type: "application/pdf" }, PDF).ok).toBe(false);
  });
});

describe("cleanFileName", () => {
  it("strips paths and control characters", () => {
    expect(cleanFileName("C:\\Users\\me\\kit.pdf")).toBe("kit.pdf");
    expect(cleanFileName("../../etc/kit\u0000\u001f.pdf")).toBe("kit.pdf");
    expect(cleanFileName("   ")).toBe("media-kit.pdf");
    expect(cleanFileName("a".repeat(200) + ".pdf")).toHaveLength(120);
  });
});
