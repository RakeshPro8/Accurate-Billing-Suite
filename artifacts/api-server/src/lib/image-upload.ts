import { HttpError } from "./http";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** Validates the exact data URL representation retained by repair photos. */
export function validateImageDataUrl(value: string): void {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]*={0,2})$/.exec(value);
  if (!match || match[2].length % 4 !== 0 || (match[2].includes("=") && !/^[A-Za-z0-9+/]+={1,2}$/.test(match[2]))) {
    throw new HttpError(400, "Photo must be a valid JPEG, PNG, or WebP data URL.", "INVALID_PHOTO");
  }
  const data = Buffer.from(match[2], "base64");
  if (!data.length || data.length > MAX_IMAGE_BYTES || data.toString("base64") !== match[2]) {
    throw new HttpError(400, "Photo must be a valid JPEG, PNG, or WebP data URL.", "INVALID_PHOTO");
  }
  const jpeg = data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  const png = data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp = data.length >= 12 && data.subarray(0, 4).equals(Buffer.from("RIFF")) && data.subarray(8, 12).equals(Buffer.from("WEBP"));
  if (!({ "image/jpeg": jpeg, "image/png": png, "image/webp": webp } as Record<string, boolean>)[match[1]]) {
    throw new HttpError(400, "Photo content does not match its MIME type.", "INVALID_PHOTO");
  }
}