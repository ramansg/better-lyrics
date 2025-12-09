import { gzipSync, gunzipSync, strToU8, strFromU8 } from "fflate";

const COMPRESSED_PREFIX = "__COMPRESSED__";

export function compressString(data: string): string {
  try {
    const compressed = gzipSync(strToU8(data));
    let binary = "";
    for (let i = 0; i < compressed.length; i++) {
      binary += String.fromCharCode(compressed[i]);
    }
    return `${COMPRESSED_PREFIX}${btoa(binary)}`;
  } catch (error) {
    console.warn("[Compression] Failed to compress:", error);
    return data;
  }
}

export function decompressString(data: string): string {
  if (!data.startsWith(COMPRESSED_PREFIX)) {
    return data;
  }

  try {
    const base64 = data.slice(COMPRESSED_PREFIX.length);
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return strFromU8(gunzipSync(bytes));
  } catch {
    return data;
  }
}

export function isCompressed(data: string): boolean {
  return data.startsWith(COMPRESSED_PREFIX);
}

export function getCompressionRatio(original: string, compressed: string): number {
  const originalSize = new Blob([original]).size;
  const compressedSize = new Blob([compressed]).size;
  return (1 - compressedSize / originalSize) * 100;
}
