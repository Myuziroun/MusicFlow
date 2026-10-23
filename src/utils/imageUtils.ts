/**
 * Utilitas gambar untuk menyiapkan cover art yang dapat disimpan permanen
 * dan dibaca oleh layanan notifikasi native Android.
 */

const DEFAULT_COVER_SIZE = 512;
const COVER_JPEG_QUALITY = 0.85;

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Gagal memuat gambar cover'));
    image.src = source;
  });
}

/**
 * Mengubah blob gambar menjadi data URL JPEG yang sudah diperkecil.
 *
 * Data URL dipakai karena blob URL hanya valid selama sesi WebView berjalan
 * dan tidak dapat diakses langsung oleh foreground service native.
 *
 * @param blob Data gambar asli dari tag ID3 atau file gambar.
 * @param maxSize Panjang sisi terpanjang gambar setelah diperkecil.
 * @returns Data URL JPEG yang siap disimpan di IndexedDB.
 */
export async function blobToCoverDataUrl(
  blob: Blob,
  maxSize: number = DEFAULT_COVER_SIZE
): Promise<string> {
  if (blob.size === 0) {
    throw new Error('Blob cover kosong');
  }

  const objectUrl = URL.createObjectURL(blob);

  try {
    const image = await loadImage(objectUrl);
    const sourceWidth = image.naturalWidth;
    const sourceHeight = image.naturalHeight;

    if (sourceWidth <= 0 || sourceHeight <= 0) {
      throw new Error('Dimensi cover tidak valid');
    }

    const scale = Math.min(1, maxSize / Math.max(sourceWidth, sourceHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D tidak tersedia');
    }

    // JPEG tidak mendukung transparansi; latar hitam menjaga konsistensi
    // dengan tema monokrom aplikasi.
    context.fillStyle = '#000000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/jpeg', COVER_JPEG_QUALITY);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Mengubah blob URL yang masih aktif menjadi data URL.
 * Blob URL lama dari sesi sebelumnya akan gagal dan dikembalikan sebagai undefined.
 *
 * @param url Blob URL cover.
 * @param maxSize Panjang sisi terpanjang gambar setelah diperkecil.
 * @returns Data URL JPEG atau undefined jika gambar tidak dapat dibaca.
 */
export async function blobUrlToCoverDataUrl(
  url: string,
  maxSize: number = DEFAULT_COVER_SIZE
): Promise<string | undefined> {
  try {
    const response = await fetch(url);
    if (!response.ok) return undefined;

    const blob = await response.blob();
    if (blob.type && !blob.type.startsWith('image/')) return undefined;

    return await blobToCoverDataUrl(blob, maxSize);
  } catch {
    return undefined;
  }
}
