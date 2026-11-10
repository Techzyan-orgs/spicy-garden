import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { requireAdmin, jsonError } from '@/lib/apiGuard';
import { uploadImageToCloudinary, isCloudinaryConfigured } from '@/lib/cloudinary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_DIMENSION = 2000; // px, longest side
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * POST /api/admin/menu/upload (multipart, field "file")
 *
 * Accepts JPEG/PNG/WebP only (checked by MIME type AND magic bytes), then
 * re-encodes with sharp: strips EXIF/GPS and other metadata, applies the
 * orientation, caps the size, and outputs WebP.
 *
 * Production stores images on Cloudinary only (503 when not configured).
 * Development without Cloudinary writes to public/uploads/ (git-ignored).
 */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && !isCloudinaryConfigured()) {
    return jsonError(503, 'Image uploads are unavailable: Cloudinary is not configured on the server.');
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) return jsonError(400, 'No image file provided.');

    if (!file.type || !ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
      return jsonError(400, 'Invalid file format. Only JPEG, PNG, and WebP images are permitted.');
    }
    if (file.size > MAX_FILE_SIZE) return jsonError(400, 'Image size exceeds the 5 MB limit.');

    const input = Buffer.from(await file.arrayBuffer());

    // Magic-byte check (prevents MIME-type spoofing)
    const isJpeg = input.length > 3 && input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff;
    const isPng = input.length > 4 && input[0] === 0x89 && input[1] === 0x50 && input[2] === 0x4e && input[3] === 0x47;
    const isWebp =
      input.length > 12 &&
      input.toString('ascii', 0, 4) === 'RIFF' &&
      input.toString('ascii', 8, 12) === 'WEBP';
    if (!isJpeg && !isPng && !isWebp) {
      return jsonError(400, 'Invalid or corrupted image: the content is not a genuine JPEG, PNG, or WebP image.');
    }

    // Re-encode: drops all metadata (EXIF incl. GPS) because withMetadata() is not used.
    let output: Buffer;
    try {
      output = await sharp(input, { limitInputPixels: 40_000_000 })
        .rotate() // apply EXIF orientation before it is stripped
        .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      return jsonError(400, 'The image could not be processed. Please try a different file.');
    }

    if (isCloudinaryConfigured()) {
      const result = await uploadImageToCloudinary(output, { folder: 'spicy_garden_menu' });
      if (result.success && result.url) {
        return NextResponse.json({ success: true, publicUrl: result.url, filename: result.publicId, source: 'cloudinary' });
      }
      console.error('[API Upload] Cloudinary upload failed:', result.error);
      return jsonError(502, 'The image host rejected the upload. Please try again.');
    }

    // Development only: local file (public/uploads is git-ignored).
    const filename = `dish_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.webp`;
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(path.join(uploadsDir, filename), output);
    return NextResponse.json({
      success: true,
      publicUrl: `/uploads/${filename}`,
      filename,
      source: 'local_dev',
      warning: 'Saved locally for development. Configure Cloudinary before deploying.',
    });
  } catch (error) {
    console.error('[API Upload] Unexpected error:', error);
    return jsonError(500, 'Failed to upload image.');
  }
}
