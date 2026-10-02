import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { logger } from "./logger";

let _supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (_supabaseClient) return _supabaseClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    logger.warn("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/ANON_KEY is not configured. Storage uploads are disabled.");
    return null;
  }

  _supabaseClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return _supabaseClient;
}

export const DEFAULT_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "order-reference-images";

export const ALLOWED_STORAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

export const MAX_STORAGE_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

export type UploadResult = {
  url: string;
  path: string;
};

export async function uploadFileToStorage(params: {
  buffer: Buffer;
  filename: string;
  contentType: string;
  bucket?: string;
}): Promise<UploadResult> {
  const normalizedMime = params.contentType.toLowerCase().trim();
  if (!ALLOWED_STORAGE_MIME_TYPES.has(normalizedMime)) {
    throw new Error(`Unsupported image type: ${normalizedMime}. Allowed types: ${Array.from(ALLOWED_STORAGE_MIME_TYPES).join(", ")}`);
  }

  if (params.buffer.length > MAX_STORAGE_FILE_SIZE_BYTES) {
    throw new Error(`File size (${(params.buffer.length / (1024 * 1024)).toFixed(1)}MB) exceeds the maximum allowed 15MB limit`);
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase storage is not configured on the server. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  const bucket = params.bucket || DEFAULT_STORAGE_BUCKET;
  const rawExt = params.filename.split(".").pop()?.toLowerCase() || "png";
  const extension = /^[a-z0-9]{2,5}$/.test(rawExt) ? rawExt : "png";
  const uniqueId = `${Date.now()}-${randomBytes(8).toString("hex")}.${extension}`;
  const filePath = `uploads/${uniqueId}`;

  const { data, error } = await supabase.storage.from(bucket).upload(filePath, params.buffer, {
    contentType: normalizedMime,
    upsert: false,
  });

  if (error) {
    logger.error({ error, bucket, filePath }, "Failed to upload file to Supabase storage");
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(data.path);

  return {
    url: publicUrlData.publicUrl,
    path: data.path,
  };
}

export type PresignedUploadResult = {
  signedUrl: string;
  token?: string;
  path: string;
  publicUrl: string;
};

export async function createSignedUploadUrl(params: {
  filename: string;
  contentType: string;
  bucket?: string;
}): Promise<PresignedUploadResult> {
  const normalizedMime = params.contentType.toLowerCase().trim();
  if (!ALLOWED_STORAGE_MIME_TYPES.has(normalizedMime)) {
    throw new Error(`Unsupported image type: ${normalizedMime}. Allowed types: ${Array.from(ALLOWED_STORAGE_MIME_TYPES).join(", ")}`);
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase storage is not configured on the server. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  const bucket = params.bucket || DEFAULT_STORAGE_BUCKET;
  const rawExt = params.filename.split(".").pop()?.toLowerCase() || "png";
  const extension = /^[a-z0-9]{2,5}$/.test(rawExt) ? rawExt : "png";
  const uniqueId = `${Date.now()}-${randomBytes(8).toString("hex")}.${extension}`;
  const filePath = `uploads/${uniqueId}`;

  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(filePath);

  if (error || !data) {
    logger.error({ error, bucket, filePath }, "Failed to create signed upload URL");
    throw new Error(`Failed to create signed upload URL: ${error?.message || "Unknown error"}`);
  }

  const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(filePath);

  return {
    signedUrl: data.signedUrl,
    token: data.token,
    path: filePath,
    publicUrl: publicUrlData.publicUrl,
  };
}


