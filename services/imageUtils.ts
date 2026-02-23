/**
 * V50.35 TAHAP 3: Image Compression Utility
 * Compress images using HTML5 Canvas before Base64 conversion
 */

export interface CompressionOptions {
  maxWidth?: number;      // Default 800px
  maxHeight?: number;     // Default no limit (preserve aspect ratio)
  quality?: number;       // 0-1, default 0.7
}

/**
 * Compress image file using Canvas
 * @param file - Image file to compress
 * @param options - Compression options
 * @returns Base64 string of compressed image
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<string> {
  const {
    maxWidth = 800,
    maxHeight = 0,
    quality = 0.7,
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions preserving aspect ratio
        let newWidth = img.width;
        let newHeight = img.height;
        
        if (img.width > maxWidth) {
          const ratio = maxWidth / img.width;
          newWidth = maxWidth;
          newHeight = Math.round(img.height * ratio);
        }
        
        if (maxHeight > 0 && newHeight > maxHeight) {
          const ratio = maxHeight / newHeight;
          newHeight = maxHeight;
          newWidth = Math.round(newWidth * ratio);
        }
        
        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = newWidth;
        canvas.height = newHeight;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Gagal mendapatkan canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, newWidth, newHeight);
        
        // Convert to Base64 with specified quality
        // Use 'image/jpeg' for better compression, fallback to 'image/png'
        const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const base64 = canvas.toDataURL(mimeType, quality);
        
        resolve(base64);
      };
      
      img.onerror = () => {
        reject(new Error('Gagal memuat gambar'));
      };
      
      // Set source to trigger image load
      img.src = e.target?.result as string;
    };
    
    reader.onerror = () => {
      reject(new Error('Gagal membaca file'));
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Get file size in human readable format
 * @param bytes - Size in bytes
 * @returns Formatted size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Estimate compression ratio
 * @param original - Original file size in bytes
 * @param compressed - Compressed data (Base64 string)
 * @returns Compression ratio percentage
 */
export function getCompressionRatio(original: number, compressed: string): number {
  const compressedBytes = (compressed.length * 3) / 4; // Approximate Base64 decoded size
  return Math.round(((original - compressedBytes) / original) * 100);
}
