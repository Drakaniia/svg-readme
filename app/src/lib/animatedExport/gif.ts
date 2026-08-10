import type { FrameData } from "./types";

// ─── GIF Encoding ────────────────────────────────────────────────────────────

// Minimal LZW encoder for GIF (variable code size)
function lzwEncode(pixels: Uint8Array, minCodeSize: number): Uint8Array {
  // Convert RGBA to indexed: we use the palette from the pixels
  // For simplicity, we encode raw RGBA as 8-bit indices (quantize to 256 colors)
  const codeSize = minCodeSize;
  const clearCode = 1 << codeSize;
  const eoiCode = clearCode + 1;

  // Build a simple color table from pixel data
  const colorMap = new Map<string, number>();
  const indices: number[] = [];
  const palette: [number, number, number][] = [];

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const key = `${r},${g},${b}`;
    let idx = colorMap.get(key);
    if (idx === undefined) {
      if (palette.length >= 256) {
        // Too many colors — find nearest in palette
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let j = 0; j < palette.length; j++) {
          const [pr, pg, pb] = palette[j];
          const dr = r - pr, dg = g - pg, db = b - pb;
          const dist = dr * dr + dg * dg + db * db;
          if (dist < bestDist) {
            bestDist = dist;
            bestIdx = j;
          }
        }
        idx = bestIdx;
      } else {
        idx = palette.length;
        palette.push([r, g, b]);
        colorMap.set(key, idx);
      }
    }
    indices.push(idx);
  }

  // LZW compression
  const dict = new Map<string, number>();
  // Initialize dictionary with single-pixel values (0..255) + clear + eoi
  for (let i = 0; i < 256; i++) dict.set(String(i), i);
  dict.set("clear", clearCode);
  dict.set("eoi", eoiCode);
  let nextCode = eoiCode + 1;
  let currentBits = codeSize + 1;
  let maxCodeForBits = 1 << currentBits;

  const bitBuffer: number[] = [];

  function writeBits(value: number, numBits: number) {
    for (let i = 0; i < numBits; i++) {
      bitBuffer.push((value >> i) & 1);
    }
  }

  // Start with clear code
  writeBits(clearCode, currentBits);

  if (indices.length === 0) {
    writeBits(eoiCode, currentBits);
  } else {
    let w = String(indices[0]);
    for (let i = 1; i < indices.length; i++) {
      const k = String(indices[i]);
      const wk = w + "," + k;
      if (dict.has(wk)) {
        w = wk;
      } else {
        writeBits(dict.get(w)!, currentBits);
        if (nextCode < 4096) {
          dict.set(wk, nextCode++);
          // Increase bit size when we exhaust current range
          if (nextCode > maxCodeForBits && currentBits < 12) {
            currentBits++;
            maxCodeForBits = 1 << currentBits;
          }
        }
        w = k;
      }
    }
    writeBits(dict.get(w)!, currentBits);
    writeBits(eoiCode, currentBits);
  }

  // Convert bit buffer to bytes
  const bytes: number[] = [];
  while (bitBuffer.length > 0) {
    let byte = 0;
    for (let i = 0; i < 8 && bitBuffer.length > 0; i++) {
      byte |= (bitBuffer.shift()!) << i;
    }
    bytes.push(byte);
  }

  return new Uint8Array(bytes);
}

function encodeStr(s: string): Uint8Array {
  const arr = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i);
  return arr;
}

function extractPalette(pixels: Uint8ClampedArray, maxColors: number): [number, number, number][] {
  const colorMap = new Map<string, number>();
  const palette: [number, number, number][] = [];
  // Count color frequency
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const key = `${r},${g},${b}`;
    if (!colorMap.has(key) && palette.length < maxColors) {
      colorMap.set(key, palette.length);
      palette.push([r, g, b]);
    }
  }
  return palette;
}

function quantizeToPalette(
  pixels: Uint8ClampedArray,
  palette: [number, number, number][],
): Uint8Array {
  const indices = new Uint8Array(pixels.length / 4);
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let j = 0; j < palette.length; j++) {
      const [pr, pg, pb] = palette[j];
      const dr = r - pr, dg = g - pg, db = b - pb;
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = j;
      }
    }
    indices[i / 4] = bestIdx;
  }
  return indices;
}

/** Encode frames as a GIF89a (with NETSCAPE2.0 looping extension) */
export function encodeGif(frames: FrameData[], width: number, height: number): Uint8Array {
  const parts: Uint8Array[] = [];

  // Header
  parts.push(encodeStr("GIF89a"));

  // Logical Screen Descriptor (7 bytes)
  const lsd = new Uint8Array(7);
  lsd[0] = width & 0xff;
  lsd[1] = (width >> 8) & 0xff;
  lsd[2] = height & 0xff;
  lsd[3] = (height >> 8) & 0xff;
  lsd[4] = 0xf7; // global color table follows, 256 colors
  lsd[5] = 0; // background color index
  lsd[6] = 0; // pixel aspect ratio
  parts.push(lsd);

  // Global Color Table: extract from first frame
  const palette = extractPalette(frames[0].pixels, 256);
  // Pad to 256 entries
  while (palette.length < 256) palette.push([0, 0, 0]);
  const gct = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    gct[i * 3] = palette[i][0];
    gct[i * 3 + 1] = palette[i][1];
    gct[i * 3 + 2] = palette[i][2];
  }
  parts.push(gct);

  // Application Extension (NETSCAPE2.0) for looping
  const loopExt = new Uint8Array([
    0x21, 0xff, // extension introducer + application extension label
    0x0b, // block size
    ...encodeStr("NETSCAPE2.0"),
    0x03, // sub-block size
    0x01, // data sub-block index
    0x00, 0x00, // loop count (0 = infinite)
    0x00, // block terminator
  ]);
  parts.push(loopExt);

  // Frames
  for (const frame of frames) {
    // Graphic Control Extension (8 bytes, including introducer/label)
    const gce = new Uint8Array(8);
    gce[0] = 0x21; // extension introducer
    gce[1] = 0xf9; // graphic control label
    gce[2] = 0x04; // block size
    gce[3] = 0x01; // packed: disposal method = keep, no transparency
    gce[4] = frame.delay & 0xff;
    gce[5] = (frame.delay >> 8) & 0xff;
    gce[6] = 0; // transparent color index (0 when no transparency)
    gce[7] = 0x00; // block terminator
    parts.push(gce);

    // Image Descriptor (10 bytes)
    const imgDesc = new Uint8Array(10);
    imgDesc[0] = 0x2c; // image separator
    imgDesc[1] = 0; imgDesc[2] = 0; // left position
    imgDesc[3] = 0; imgDesc[4] = 0; // top position
    imgDesc[5] = width & 0xff;
    imgDesc[6] = (width >> 8) & 0xff;
    imgDesc[7] = height & 0xff;
    imgDesc[8] = (height >> 8) & 0xff;
    imgDesc[9] = 0x00; // packed: no local color table
    parts.push(imgDesc);

    // Index the pixel data against the global palette
    const indexed = quantizeToPalette(frame.pixels, palette);
    const lzwData = lzwEncode(indexed, 8);

    // LZW Minimum Code Size byte
    parts.push(new Uint8Array([8]));

    // Split into sub-blocks (max 255 bytes each)
    let offset = 0;
    while (offset < lzwData.length) {
      const blockSize = Math.min(255, lzwData.length - offset);
      const subBlock = new Uint8Array(1 + blockSize);
      subBlock[0] = blockSize;
      subBlock.set(lzwData.subarray(offset, offset + blockSize), 1);
      parts.push(subBlock);
      offset += blockSize;
    }
    // Block terminator
    parts.push(new Uint8Array([0x00]));
  }

  // Trailer
  parts.push(new Uint8Array([0x3b]));

  // Combine all parts
  let totalLength = 0;
  for (const p of parts) totalLength += p.length;
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const p of parts) {
    result.set(p, pos);
    pos += p.length;
  }
  return result;
}
