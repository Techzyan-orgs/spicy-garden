import { v2 as cloudinary } from 'cloudinary';

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

// Lazy configure on invocation
function getCloudinary() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return cloudinary;
}

export interface CloudinaryUploadResult {
  success: boolean;
  url?: string;
  publicId?: string;
  width?: number;
  height?: number;
  format?: string;
  error?: string;
}

/**
 * Upload an image buffer directly to Cloudinary.
 * Applies automatic WebP optimization and responsive formatting.
 */
export async function uploadImageToCloudinary(
  buffer: Buffer,
  options: {
    folder?: string;
    publicId?: string;
  } = {}
): Promise<CloudinaryUploadResult> {
  if (!isCloudinaryConfigured()) {
    return {
      success: false,
      error: 'Cloudinary credentials (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are not configured in environment variables.',
    };
  }

  const client = getCloudinary();
  const folder = options.folder || 'spicy_garden_menu';

  return new Promise((resolve) => {
    const uploadStream = client.uploader.upload_stream(
      {
        folder,
        public_id: options.publicId,
        resource_type: 'image',
        transformation: [
          { quality: 'auto', fetch_format: 'auto' },
          { width: 1400, crop: 'limit' },
        ],
      },
      (error, result) => {
        if (error || !result) {
          console.error('[Cloudinary Upload] Error:', error);
          let errMsg = error?.message || 'Failed to upload image to Cloudinary.';
          if (errMsg.includes('missing permissions') || errMsg.includes('actions=["create"]')) {
            errMsg = 'Cloudinary API Key lacks upload ("create") permission. Please enable the "create" action in Cloudinary Console -> Settings -> Access Keys.';
          }
          resolve({
            success: false,
            error: errMsg,
          });
        } else {
          resolve({
            success: true,
            url: result.secure_url,
            publicId: result.public_id,
            width: result.width,
            height: result.height,
            format: result.format,
          });
        }
      }
    );

    uploadStream.end(buffer);
  });
}
