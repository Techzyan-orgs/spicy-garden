import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { verifyOwnerSessionToken, OWNER_SESSION_COOKIE } from '@/lib/auth';
import { uploadImageToCloudinary, isCloudinaryConfigured } from '@/lib/cloudinary';

export const dynamic = 'force-dynamic';

async function checkAdminAuth(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(OWNER_SESSION_COOKIE)?.value;
  return await verifyOwnerSessionToken(token);
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  if (!(await checkAdminAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized: Owner session required.' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No image file provided.' }, { status: 400 });
    }

    // Validate MIME type strictly to raster images (rejecting SVGs to prevent Stored XSS)
    const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
    if (!file.type || !ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
      return NextResponse.json(
        { error: 'Invalid file format. Only JPEG, PNG, and WebP raster images are permitted.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Image size exceeds maximum limit of 5 MB.' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Validate binary magic bytes to prevent MIME-type spoofing
    const isJpeg = buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isPng = buffer.length > 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    const isWebp =
      buffer.length > 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && // "RIFF"
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50; // "WEBP"

    if (!isJpeg && !isPng && !isWebp) {
      return NextResponse.json(
        { error: 'Invalid or corrupted image content. Magic bytes do not match a genuine JPEG, PNG, or WebP image.' },
        { status: 400 }
      );
    }

    // 1. Primary: Upload to Cloudinary CDN
    let cloudinaryError: string | null = null;
    if (isCloudinaryConfigured()) {
      try {
        const uploadResult = await uploadImageToCloudinary(buffer, {
          folder: 'spicy_garden_menu',
        });

        if (uploadResult.success && uploadResult.url) {
          return NextResponse.json({
            success: true,
            publicUrl: uploadResult.url,
            filename: uploadResult.publicId,
            source: 'cloudinary',
          });
        }
        cloudinaryError = uploadResult.error || 'Cloudinary upload returned failure.';
        console.warn('[API Upload] Cloudinary upload notice:', cloudinaryError);
      } catch (cErr: any) {
        cloudinaryError = cErr?.message || 'Cloudinary upload exception.';
        console.warn('[API Upload] Cloudinary upload exception:', cloudinaryError);
      }
    }

    // 2. Dev Fallback: Local filesystem (Only when running locally in development)
    if (process.env.NODE_ENV !== 'production') {
      const rawExt = file.name.split('.').pop()?.toLowerCase();
      const safeExt = rawExt && ['jpg', 'jpeg', 'png', 'webp'].includes(rawExt) ? rawExt : 'webp';
      const filename = `dish_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${safeExt}`;
      const publicUrl = `/uploads/${filename}`;

      try {
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const filePath = path.join(uploadsDir, filename);
        fs.writeFileSync(filePath, buffer);

        return NextResponse.json({
          success: true,
          publicUrl,
          filename,
          source: 'local_dev_fallback',
          warning: cloudinaryError ? `Cloudinary notice: ${cloudinaryError}` : undefined,
        });
      } catch (localErr) {
        console.warn('[API Upload] Local filesystem write failed:', localErr);
      }
    }

    // 3. Fallback: Only allow micro-thumbnails (<64 KB) as embedded data URLs to protect Vercel 4.5 MB limit and page speed
    const MAX_EMBEDDED_BYTES = 64 * 1024;
    if (buffer.length <= MAX_EMBEDDED_BYTES) {
      const mimeType = isWebp ? 'image/webp' : isPng ? 'image/png' : 'image/jpeg';
      const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
      return NextResponse.json({
        success: true,
        publicUrl: dataUrl,
        filename: `embedded_${Date.now()}`,
        source: 'embedded_fallback',
        warning: cloudinaryError
          ? `Uploaded as embedded image thumbnail. (Cloudinary: ${cloudinaryError})`
          : undefined,
      });
    }

    return NextResponse.json(
      {
        error:
          cloudinaryError ||
          'Cloudinary image upload failed. Please verify CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your Vercel project environment variables.',
      },
      { status: 502 }
    );
  } catch (error: any) {
    console.error('[API Upload] Unexpected error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to upload image.' },
      { status: 500 }
    );
  }
}
