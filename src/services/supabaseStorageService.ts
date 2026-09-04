import { supabase } from './supabaseClient';

export interface StorageUploadResult {
  url: string;
  isSupabaseStorage: boolean;
  error?: string;
}

class SupabaseStorageService {
  private bucketName = 'products';

  /**
   * Upload an image file directly to Supabase Storage bucket ('products').
   * Returns the permanent public CDN URL from Supabase Storage.
   * If the bucket does not exist or upload is blocked by policy, gracefully falls back
   * to Base64 so the user's flow is never interrupted.
   */
  public async uploadProductImage(file: File): Promise<StorageUploadResult> {
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const cleanFileName = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    const filePath = `items/${cleanFileName}`;

    try {
      // 1. Try uploading to Supabase Storage
      const { error } = await supabase.storage
        .from(this.bucketName)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type || 'image/jpeg',
        });

      if (error) {
        console.warn('Supabase storage upload error:', error);
        const fallbackUrl = await this.fileToBase64(file);
        return {
          url: fallbackUrl,
          isSupabaseStorage: false,
          error: error.message,
        };
      }

      // 2. Retrieve public permanent URL
      const { data: urlData } = supabase.storage
        .from(this.bucketName)
        .getPublicUrl(filePath);

      return {
        url: urlData.publicUrl,
        isSupabaseStorage: true,
      };
    } catch (err: any) {
      console.warn('Supabase storage exception:', err);
      const fallbackUrl = await this.fileToBase64(file);
      return {
        url: fallbackUrl,
        isSupabaseStorage: false,
        error: err?.message || 'Storage upload failed',
      };
    }
  }

  /**
   * Helper to convert File to Base64 data URL string
   */
  public fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  /**
   * Extracts the relative path within the 'products' bucket from a public URL or path string.
   */
  public extractFilePath(imageUrlOrPath?: string): string | null {
    if (!imageUrlOrPath || typeof imageUrlOrPath !== 'string') return null;
    if (imageUrlOrPath.startsWith('data:') || imageUrlOrPath.startsWith('blob:')) return null;

    // Check if it's a Supabase storage URL for the products bucket
    const marker = `/${this.bucketName}/`;
    const index = imageUrlOrPath.indexOf(marker);
    if (index !== -1) {
      const sub = imageUrlOrPath.substring(index + marker.length);
      return sub.split('?')[0].split('#')[0];
    }

    // If it's already a relative path like 'items/prod_123.jpg'
    if (imageUrlOrPath.startsWith('items/')) {
      return imageUrlOrPath.split('?')[0].split('#')[0];
    }

    return null;
  }

  /**
   * Delete a product image from Supabase Storage bucket ('products').
   * Accepts either the full public URL or relative file path.
   */
  public async deleteProductImage(imageUrlOrPath?: string): Promise<boolean> {
    const filePath = this.extractFilePath(imageUrlOrPath);
    if (!filePath) {
      return false;
    }

    try {
      const { error } = await supabase.storage
        .from(this.bucketName)
        .remove([filePath]);

      if (error) {
        console.warn('Failed to delete image from Supabase storage:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('Exception deleting image from Supabase storage:', err);
      return false;
    }
  }

  /**
   * Check if 'products' bucket is accessible in Supabase Storage
   */
  public async checkBucketExists(): Promise<boolean> {
    try {
      const { data, error } = await supabase.storage.listBuckets();
      if (error || !data) return false;
      return data.some((b) => b.name === this.bucketName || b.id === this.bucketName);
    } catch {
      return false;
    }
  }
}

export const supabaseStorageService = new SupabaseStorageService();
