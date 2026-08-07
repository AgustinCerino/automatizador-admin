import { describe, expect, it } from "vitest";

import {
  abbreviateChecksum,
  formatFileSize,
  formatNumber,
} from "@/lib/format-values";

describe("formatos operativos", () => {
  it("formatea números con locale es-AR y tolera null", () => {
    expect(formatNumber(12345)).toBe("12.345");
    expect(formatNumber(null)).toBe("—");
  });

  it("selecciona unidades legibles de tamaño", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1536)).toBe("1,5 KB");
    expect(formatFileSize(1024 ** 2)).toBe("1 MB");
    expect(formatFileSize(1024 ** 3)).toBe("1 GB");
  });

  it("abrevia checksums largos y conserva los breves", () => {
    expect(abbreviateChecksum("1234567890abcdefXYZ9876")).toBe("12345678…9876");
    expect(abbreviateChecksum("abc123")).toBe("abc123");
    expect(abbreviateChecksum(undefined)).toBe("—");
  });
});
