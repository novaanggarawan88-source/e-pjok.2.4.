/**
 * IndexedDB & Cloud Firestore Media Storage for PJOK Assessment Evidence
 *
 * Mengizinkan penyimpanan video & foto bukti gerakan PJOK secara sinkron
 * antar laptop guru dan HP murid melalui Firestore chunks dan IndexedDB local cache.
 */

import { db, isFirebaseConfigured } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const DB_NAME = 'pjok_media_db';
const DB_VERSION = 1;
const STORE_NAME = 'evidence_media';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB tidak didukung pada browser ini'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string, mimeType = 'video/mp4'): Blob {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * Sanitasi string ID agar aman digunakan sebagai kunci IndexedDB
 * dan ID dokumen Firestore tanpa karakter slash (/) yang memicu sub-koleksi tak valid.
 */
export function sanitizeMediaKey(id: string): string {
  if (!id) return '';
  return id
    .replace(/^idb:\/\//, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_');
}

export const MediaStore = {
  /**
   * Menyimpan file/blob secara instan ke IndexedDB lokal
   */
  async saveMedia(id: string, file: Blob | File): Promise<string> {
    const cleanId = sanitizeMediaKey(id);
    try {
      const database = await openDB();
      return new Promise((resolve) => {
        const tx = database.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(file, cleanId);

        req.onsuccess = () => resolve(`idb://${cleanId}`);
        req.onerror = () => {
          console.warn('Gagal menyimpan ke IndexedDB:', req.error);
          resolve(`idb://${cleanId}`);
        };
      });
    } catch (e) {
      console.warn('Gagal membuka IndexedDB:', e);
      return `idb://${cleanId}`;
    }
  },

  /**
   * Mengambil Blob dari IndexedDB lokal
   */
  async getBlobFromIndexedDB(id: string): Promise<Blob | null> {
    const cleanId = sanitizeMediaKey(id);
    const rawId = id.replace(/^idb:\/\//, '');

    try {
      const database = await openDB();
      return new Promise((resolve) => {
        const tx = database.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);

        // Coba cari dengan sanitized key dahulu
        const req = store.get(cleanId);
        req.onsuccess = () => {
          const result = req.result;
          if (result instanceof Blob) {
            resolve(result);
            return;
          }

          // Fallback coba cari dengan raw key jika berbeda
          if (rawId !== cleanId) {
            const req2 = store.get(rawId);
            req2.onsuccess = () => {
              if (req2.result instanceof Blob) {
                resolve(req2.result);
              } else {
                resolve(null);
              }
            };
            req2.onerror = () => resolve(null);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      console.warn('Gagal membaca IndexedDB:', e);
      return null;
    }
  },

  /**
   * Mengunggah potongan (chunks) video ke Firestore agar tersinkronisasi
   * ke laptop guru & HP siswa lain secara cloud.
   */
  async uploadToFirestoreChunks(
    mediaId: string,
    file: Blob | File,
    onProgress?: (percent: number) => void
  ): Promise<boolean> {
    const firestore = db;
    if (!isFirebaseConfigured() || !firestore) return false;
    try {
      const cleanId = sanitizeMediaKey(mediaId);
      const CHUNK_SIZE = 450 * 1024; // 450 KB per slice (~600KB base64, safe under 1MB Firestore limit)
      const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
      const mimeType = file.type || 'video/mp4';

      // Upload paralel per 4 potongan agar proses upload cepat
      const BATCH_SIZE = 4;
      for (let i = 0; i < totalChunks; i += BATCH_SIZE) {
        const batchPromises: Promise<any>[] = [];
        for (let j = i; j < Math.min(i + BATCH_SIZE, totalChunks); j++) {
          const start = j * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const slice = file.slice(start, end, mimeType);

          const uploadSlice = async (idx: number, blobSlice: Blob) => {
            const base64Data = await blobToBase64(blobSlice);
            await setDoc(doc(firestore, 'media_chunks', `${cleanId}_${idx}`), {
              mediaId: cleanId,
              chunkIndex: idx,
              totalChunks,
              mimeType,
              data: base64Data,
              size: blobSlice.size,
              createdAt: new Date().toISOString()
            });
          };

          batchPromises.push(uploadSlice(j, slice));
        }

        await Promise.all(batchPromises);
        const uploadedCount = Math.min(i + BATCH_SIZE, totalChunks);
        onProgress?.(Math.round((uploadedCount / totalChunks) * 100));
      }

      return true;
    } catch (err) {
      console.warn('Firestore video chunk upload error:', err);
      return false;
    }
  },

  /**
   * Mengambil file/blob dari IndexedDB lokal ATAU Cloud Firestore chunks
   * dan mengembalikan Object URL siap diputar di tag <video>.
   */
  async getMediaUrl(
    id: string,
    onDownloadProgress?: (percent: number) => void
  ): Promise<string | null> {
    if (!id) return null;

    // Jika sudah URL langsung (http, https, data:video, data:image, blob:)
    if (
      id.startsWith('http://') ||
      id.startsWith('https://') ||
      id.startsWith('data:video') ||
      id.startsWith('data:image') ||
      id.startsWith('blob:')
    ) {
      return id;
    }

    const cleanId = sanitizeMediaKey(id);

    // 1. Cek IndexedDB perangkat ini dulu (pemutaran lokal instan 0 ms)
    try {
      const localBlob = await this.getBlobFromIndexedDB(id);
      if (localBlob && localBlob.size > 0) {
        return URL.createObjectURL(localBlob);
      }
    } catch (err) {
      console.warn('IndexedDB check failed:', err);
    }

    // 2. Jika tidak ada di lokal (misal guru membuka di laptop saat murid kirim lewat HP),
    // ambil pecahan video dari Firestore Cloud
    if (isFirebaseConfigured() && db) {
      try {
        const firstDocRef = doc(db, 'media_chunks', `${cleanId}_0`);
        const firstSnap = await getDoc(firstDocRef);
        if (firstSnap.exists()) {
          const firstData = firstSnap.data();
          const totalChunks = Number(firstData.totalChunks) || 1;
          const mimeType = firstData.mimeType || 'video/mp4';

          const chunkBlobs: (Blob | null)[] = new Array(totalChunks).fill(null);
          chunkBlobs[0] = base64ToBlob(firstData.data, mimeType);
          onDownloadProgress?.(Math.round((1 / totalChunks) * 100));

          if (totalChunks > 1) {
            // Unduh pecahan lainnya secara paralel (batch 5)
            const BATCH_SIZE = 5;
            for (let i = 1; i < totalChunks; i += BATCH_SIZE) {
              const batchPromises: Promise<any>[] = [];
              for (let j = i; j < Math.min(i + BATCH_SIZE, totalChunks); j++) {
                const fetchChunk = async (idx: number) => {
                  const chunkDoc = await getDoc(doc(db, 'media_chunks', `${cleanId}_${idx}`));
                  if (chunkDoc.exists()) {
                    chunkBlobs[idx] = base64ToBlob(chunkDoc.data().data, mimeType);
                  }
                };
                batchPromises.push(fetchChunk(j));
              }
              await Promise.all(batchPromises);
              const downloaded = chunkBlobs.filter(Boolean).length;
              onDownloadProgress?.(Math.round((downloaded / totalChunks) * 100));
            }
          }

          if (chunkBlobs.every(Boolean)) {
            const fullBlob = new Blob(chunkBlobs as Blob[], { type: mimeType });
            // Simpan ke IndexedDB lokal agar selanjutnya pemutaran berikutnya instan (<10ms)
            try {
              await this.saveMedia(cleanId, fullBlob);
            } catch {}
            return URL.createObjectURL(fullBlob);
          }
        }
      } catch (err) {
        console.warn('Gagal memuat video chunks dari Firestore:', err);
      }
    }

    return null;
  },

  /**
   * Cek apakah URL merupakan tautan video eksternal (Google Drive / YouTube)
   */
  isExternalVideoLink(url?: string | null): boolean {
    if (!url) return false;
    return url.includes('drive.google.com') || url.includes('youtube.com') || url.includes('youtu.be');
  },

  /**
   * Format tautan embed video Drive atau YouTube agar bisa diputar langsung di iframe
   */
  formatExternalVideoEmbedUrl(url?: string | null): string | null {
    if (!url) return null;
    if (url.includes('drive.google.com')) {
      const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        return `https://drive.google.com/file/d/${match[1]}/preview`;
      }
      return url;
    }
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const match = url.match(/(?:watch\?v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
      if (match && match[1]) {
        return `https://www.youtube-nocookie.com/embed/${match[1]}?autoplay=1&rel=0`;
      }
      return url;
    }
    return null;
  },

  /**
   * Mengekstrak cuplikan (thumbnail) frame video dalam ukuran kecil (~15-25 KB)
   * agar dapat langsung disimpan ke Firestore & dilihat guru/siswa secara instan
   */
  async generateVideoThumbnail(file: File | Blob): Promise<string | null> {
    return new Promise((resolve) => {
      try {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;

        const objectUrl = URL.createObjectURL(file);
        video.src = objectUrl;

        video.onloadedmetadata = () => {
          video.currentTime = Math.min(1, Math.max(0.2, video.duration * 0.1));
        };

        video.onseeked = () => {
          try {
            const canvas = document.createElement('canvas');
            const maxW = 480;
            const scale = Math.min(1, maxW / (video.videoWidth || 480));
            canvas.width = Math.round((video.videoWidth || 480) * scale);
            canvas.height = Math.round((video.videoHeight || 270) * scale);

            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const thumbUrl = canvas.toDataURL('image/jpeg', 0.6);
              URL.revokeObjectURL(objectUrl);
              resolve(thumbUrl);
              return;
            }
          } catch (err) {
            console.warn('Thumbnail generation error:', err);
          }
          URL.revokeObjectURL(objectUrl);
          resolve(null);
        };

        video.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          resolve(null);
        };

        setTimeout(() => {
          URL.revokeObjectURL(objectUrl);
          resolve(null);
        }, 3000);
      } catch {
        resolve(null);
      }
    });
  },

  /**
   * Mengompresi foto bukti gerakan jika diunggah dalam ukuran besar
   */
  async compressImage(file: File, maxWidth = 1000, quality = 0.7): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
            return;
          }
          resolve(e.target?.result as string);
        };
        img.onerror = () => resolve(e.target?.result as string);
        img.src = e.target?.result as string;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  }
};
