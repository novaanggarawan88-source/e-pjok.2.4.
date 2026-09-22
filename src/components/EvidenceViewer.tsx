import React, { useState, useEffect, useRef } from 'react';
import { MediaStore, sanitizeMediaKey } from '../lib/mediaStore';
import {
  Video,
  Play,
  AlertCircle,
  RefreshCw,
  Upload,
  Film,
  Link as LinkIcon,
  Maximize2,
  X,
  CheckCircle2
} from 'lucide-react';

interface EvidenceViewerProps {
  evidenceUrl?: string | null;
  thumbnailUrl?: string | null;
  evidenceType?: 'video' | 'foto' | 'none' | string;
  className?: string;
  autoPlay?: boolean;
  onUpdateEvidence?: (newUrl: string, newThumbnail?: string | null) => void;
}

export const EvidenceViewer: React.FC<EvidenceViewerProps> = ({
  evidenceUrl,
  thumbnailUrl,
  evidenceType = 'video',
  className = 'w-full max-h-80 object-contain',
  autoPlay = false,
  onUpdateEvidence
}) => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [hasError, setHasError] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const [showFullPhoto, setShowFullPhoto] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isExternalVideo = MediaStore.isExternalVideoLink(evidenceUrl) || MediaStore.isExternalVideoLink(videoUrl);

  const loadMedia = async () => {
    setHasError(false);
    setUploadSuccess(false);

    if (!evidenceUrl) {
      setVideoUrl(null);
      return;
    }

    // 1. Jika tautan Google Drive atau YouTube eksternal
    if (MediaStore.isExternalVideoLink(evidenceUrl)) {
      setVideoUrl(evidenceUrl);
      return;
    }

    // 2. Jika tautan video langsung (http, https, blob, data:video)
    if (
      evidenceUrl.startsWith('http://') ||
      evidenceUrl.startsWith('https://') ||
      evidenceUrl.startsWith('blob:') ||
      evidenceUrl.startsWith('data:video')
    ) {
      setVideoUrl(evidenceUrl);
      return;
    }

    // 3. Jika tersimpan di IndexedDB atau potongan Firestore chunks (idb://)
    setLoading(true);
    setDownloadProgress(0);

    try {
      const url = await MediaStore.getMediaUrl(evidenceUrl, (pct) => {
        setDownloadProgress(pct);
      });

      if (url) {
        setVideoUrl(url);
        setHasError(false);
      } else {
        setVideoUrl(null);
        setHasError(true);
      }
    } catch (err) {
      console.warn('Gagal memuat video:', err);
      setVideoUrl(null);
      setHasError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMedia();
  }, [evidenceUrl]);

  useEffect(() => {
    if (isPlaying && videoRef.current) {
      videoRef.current.play().catch((e) => {
        console.warn('Video auto-play blocked or failed:', e);
      });
    }
  }, [isPlaying, videoUrl]);

  // Handle unggah / ganti video baru
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setHasError(false);
    try {
      const uniqueKey = `media_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const cleanKey = sanitizeMediaKey(uniqueKey);

      // 1. Simpan di IndexedDB
      await MediaStore.saveMedia(cleanKey, file);

      // 2. Buat thumbnail snapshot
      let newThumb: string | null = null;
      try {
        newThumb = await MediaStore.generateVideoThumbnail(file);
      } catch {}

      // 3. Unggah chunks ke Firestore Cloud agar tersinkronisasi ke perangkat lain
      await MediaStore.uploadToFirestoreChunks(cleanKey, file, (pct) => {
        setDownloadProgress(pct);
      });

      const newIdbUrl = `idb://${cleanKey}`;
      const objectUrl = URL.createObjectURL(file);

      if (onUpdateEvidence) {
        onUpdateEvidence(newIdbUrl, newThumb || thumbnailUrl);
      }

      setVideoUrl(objectUrl);
      setHasError(false);
      setIsPlaying(true);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    } catch (err) {
      console.error('Gagal mengunggah video pengganti:', err);
      setHasError(true);
    } finally {
      setIsUploading(false);
    }
  };

  // Handle tempel tautan Google Drive / YouTube
  const handleApplyLink = () => {
    if (!linkInput.trim()) return;
    const cleanUrl = linkInput.trim();

    if (onUpdateEvidence) {
      onUpdateEvidence(cleanUrl, thumbnailUrl);
    }

    setVideoUrl(cleanUrl);
    setHasError(false);
    setShowLinkInput(false);
    setLinkInput('');
    setIsPlaying(true);
    setUploadSuccess(true);
    setTimeout(() => setUploadSuccess(false), 3000);
  };

  if (!evidenceUrl && !thumbnailUrl) {
    return (
      <div className="w-full py-8 flex flex-col items-center justify-center text-slate-400 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
        <Film className="w-8 h-8 mb-1.5 opacity-50" />
        <p className="text-xs font-semibold">Tidak ada lampiran bukti gerakan</p>
      </div>
    );
  }

  const isVideo =
    evidenceType === 'video' ||
    (!evidenceType && (evidenceUrl?.endsWith('.mp4') || evidenceUrl?.includes('video') || isExternalVideo));

  // ================= TAMPILAN VIDEO =================
  if (isVideo) {
    // 1. Jika pengguna adalah tautan Google Drive atau YouTube
    if (isExternalVideo && videoUrl) {
      const embedUrl = MediaStore.formatExternalVideoEmbedUrl(videoUrl);
      if (embedUrl) {
        return (
          <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-inner">
            <iframe
              src={embedUrl}
              title="Bukti Video Gerakan"
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        );
      }
    }

    // 2. Loading saat mengunduh chunks dari cloud
    if (loading) {
      return (
        <div className="relative w-full aspect-video bg-slate-950 rounded-2xl flex flex-col items-center justify-center p-6 text-center text-white">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
          <p className="text-sm font-bold text-slate-100">Memuat Video Gerakan Siswa...</p>
          <p className="text-xs text-slate-400 mt-1">
            Mengunduh potongan video dari Cloud Database ({downloadProgress}%)
          </p>
          <div className="w-48 bg-slate-800 rounded-full h-1.5 mt-3 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${Math.max(8, downloadProgress)}%` }}
            />
          </div>
        </div>
      );
    }

    // 3. Sedang memutar video dan video siap diputar
    if (videoUrl && !hasError && isPlaying) {
      return (
        <div className="relative w-full bg-black rounded-2xl overflow-hidden flex flex-col items-center justify-center">
          <video
            key={videoUrl}
            ref={videoRef}
            src={videoUrl}
            poster={thumbnailUrl || undefined}
            controls
            playsInline
            autoPlay
            preload="auto"
            onError={() => {
              console.warn('Video failed to render in HTML5 video tag');
              setHasError(true);
            }}
            className={className}
          >
            <source src={videoUrl} type="video/mp4" />
            <source src={videoUrl} type="video/webm" />
            <source src={videoUrl} type="video/quicktime" />
            Browser Anda tidak mendukung pemutaran langsung format video ini.
          </video>
        </div>
      );
    }

    // 4. Jika video tidak dapat diputar / chunks belum tersimpan di cloud
    if (hasError || (!videoUrl && !loading)) {
      return (
        <div className="relative w-full bg-slate-900 rounded-2xl overflow-hidden p-4 flex flex-col items-center justify-center text-center">
          {thumbnailUrl ? (
            <div className="relative w-full max-h-56 rounded-xl overflow-hidden mb-3 border border-slate-800 bg-black flex items-center justify-center">
              <img
                src={thumbnailUrl}
                alt="Cuplikan Foto Gerakan Siswa"
                className="w-full max-h-56 object-contain opacity-90"
              />
              <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-xs px-2.5 py-1 rounded-lg text-[11px] font-bold text-emerald-400 flex items-center gap-1.5 shadow-xs">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Cuplikan Foto Gerakan Tersimpan
              </div>
              <button
                type="button"
                onClick={() => setShowFullPhoto(true)}
                className="absolute top-2 right-2 bg-black/75 hover:bg-black text-white p-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors cursor-pointer"
                title="Lihat Foto Ukuran Penuh"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <AlertCircle className="w-10 h-10 text-amber-400 mb-2" />
          )}

          <h5 className="text-xs font-bold text-slate-100">
            Video Rekaman Asli Berada di Memori Pengirim
          </h5>
          <p className="text-[11px] text-slate-400 max-w-md mt-1 mb-3 leading-relaxed">
            Rekaman video tersimpan di perangkat HP murid pengunggah sebelum sinkronisasi cloud diaktifkan.
            Foto cuplikan gerakan di atas berhasil diabadikan dengan aman.
          </p>

          {/* Form tautan link jika dibuka */}
          {showLinkInput ? (
            <div className="w-full max-w-md mb-3 p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-left">
              <label className="block text-[11px] font-bold text-slate-300 mb-1.5">
                Tautkan Link Video (Google Drive / YouTube / MP4):
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://drive.google.com/file/d/.../view"
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleApplyLink}
                  disabled={!linkInput.trim()}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                >
                  Simpan
                </button>
                <button
                  type="button"
                  onClick={() => setShowLinkInput(false)}
                  className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </div>
          ) : null}

          {/* Action buttons */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={loadMedia}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Coba Muat Ulang
            </button>

            {onUpdateEvidence && (
              <>
                <label className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs">
                  <Upload className="w-3.5 h-3.5" />
                  {isUploading ? 'Menyimpan...' : 'Unggah Video Baru'}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={isUploading}
                  />
                </label>

                {!showLinkInput && (
                  <button
                    type="button"
                    onClick={() => setShowLinkInput(true)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <LinkIcon className="w-3.5 h-3.5 text-blue-400" />
                    Tautkan Google Drive
                  </button>
                )}
              </>
            )}

            {thumbnailUrl && (
              <button
                type="button"
                onClick={() => setShowFullPhoto(true)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                Lihat Foto Cuplikan
              </button>
            )}
          </div>

          {uploadSuccess && (
            <p className="text-xs text-emerald-400 font-bold mt-2.5 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Video berhasil diperbarui!
            </p>
          )}

          {/* Modal Tampilan Foto Penuh */}
          {showFullPhoto && thumbnailUrl && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="relative max-w-3xl w-full bg-slate-900 rounded-3xl overflow-hidden border border-slate-700 p-2 shadow-2xl">
                <button
                  type="button"
                  onClick={() => setShowFullPhoto(false)}
                  className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/60 text-white hover:bg-rose-600 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
                <img
                  src={thumbnailUrl}
                  alt="Cuplikan Penuh Gerakan Siswa"
                  className="w-full max-h-[80vh] object-contain rounded-2xl"
                />
                <div className="p-3 text-center text-xs text-slate-300">
                  Cuplikan Foto Gerakan Siswa Saat Pengambilan Penilaian
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    // 5. Tampilan awal Thumbnail dengan tombol Play besar (ketika video sudah ada & siap diputar)
    return (
      <div className="relative w-full bg-slate-950 rounded-2xl overflow-hidden group flex items-center justify-center">
        <img
          src={thumbnailUrl || ''}
          alt="Cuplikan Video Gerakan"
          className={className}
        />
        <div className="absolute inset-0 bg-black/40 hover:bg-black/30 transition-colors flex flex-col items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              setIsPlaying(true);
              if (!videoUrl && evidenceUrl) {
                loadMedia();
              }
            }}
            className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-xl transition-transform transform hover:scale-110 cursor-pointer"
            title="Putar Video Gerakan"
          >
            <Play className="w-7 h-7 ml-0.5 fill-current" />
          </button>
          <span className="text-[11px] font-bold text-white bg-black/60 px-3 py-1 rounded-full backdrop-blur-xs flex items-center gap-1.5 shadow-xs">
            <Video className="w-3.5 h-3.5 text-emerald-400" />
            Putar Video Bukti Gerakan
          </span>
        </div>
      </div>
    );
  }

  // ================= TAMPILAN FOTO =================
  return (
    <div className="w-full bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center">
      <img
        src={videoUrl || thumbnailUrl || ''}
        alt="Bukti Foto Gerakan"
        referrerPolicy="no-referrer"
        className={className}
      />
    </div>
  );
};
