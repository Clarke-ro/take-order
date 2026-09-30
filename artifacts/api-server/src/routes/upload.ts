import { Router, type IRouter, type Request, type Response } from "express";
import { uploadFileToStorage, createSignedUploadUrl } from "../lib/storage";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export function createUploadRouter(): IRouter {
  const router: IRouter = Router();

  /**
   * Direct-to-storage presigned upload URL generator.
   * High-concurrency upload path: allows mobile clients and browser apps to stream images
   * directly to Supabase Storage S3 endpoints without consuming API dyno RAM or network bandwidth.
   */
  router.post("/upload/presign", async (req: Request, res: Response): Promise<void> => {
    try {
      const { filename, contentType } = req.body ?? {};

      if (!contentType || typeof contentType !== "string") {
        res.status(400).json({ error: "contentType is required" });
        return;
      }

      const normalizedType = contentType.toLowerCase().trim();
      if (!ALLOWED_MIME_TYPES.has(normalizedType)) {
        res.status(400).json({
          error: `Unsupported image type: ${normalizedType}. Allowed types: image/jpeg, image/png, image/webp, image/gif`,
        });
        return;
      }

      const safeFilename = typeof filename === "string" && filename.trim()
        ? filename.trim()
        : `image.${normalizedType.split("/")[1] || "png"}`;

      const presigned = await createSignedUploadUrl({
        filename: safeFilename,
        contentType: normalizedType,
      });

      res.status(200).json(presigned);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to generate presigned upload URL";
      res.status(500).json({ error: message });
    }
  });

  router.post("/upload", async (req: Request, res: Response): Promise<void> => {
    try {
      const { data, filename } = req.body ?? {};

      if (!data || typeof data !== "string") {
        res.status(400).json({ error: "Image data (base64 data URL) is required" });
        return;
      }

      // Parse Data URL format: "data:<mime-type>;base64,<payload>"
      const match = data.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        res.status(400).json({ error: "Invalid image data format. Must be a base64 Data URL." });
        return;
      }

      const contentType = match[1].toLowerCase().trim();
      const base64Data = match[2];

      if (!ALLOWED_MIME_TYPES.has(contentType)) {
        res.status(400).json({
          error: `Unsupported image type: ${contentType}. Allowed types: image/jpeg, image/png, image/webp, image/gif`,
        });
        return;
      }

      const buffer = Buffer.from(base64Data, "base64");

      if (buffer.length > MAX_FILE_SIZE_BYTES) {
        res.status(400).json({ error: "File exceeds the 5MB size limit" });
        return;
      }

      const safeFilename = typeof filename === "string" && filename.trim() ? filename.trim() : `image.${contentType.split("/")[1] || "png"}`;

      const result = await uploadFileToStorage({
        buffer,
        filename: safeFilename,
        contentType,
      });

      res.status(201).json({ url: result.url });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload failed";
      res.status(500).json({ error: message });
    }
  });

  return router;
}

