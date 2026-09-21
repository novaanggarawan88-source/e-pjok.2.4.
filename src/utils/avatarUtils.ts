/**
 * Utility untuk kompresi foto profil dan preset avatar siswa PJOK
 */

export interface AvatarPreset {
  id: string;
  name: string;
  category: string;
  svgDataUri: string;
}

/**
 * Kompres gambar yang diunggah pengguna ke format JPEG Base64
 * dengan cropping rasio 1:1 (persegi) berukuran maksimal 360x360 px
 * agar ringan, cepat dimuat, dan hemat kuota database Firestore.
 */
export const compressImageFile = (
  file: File,
  maxDimension: number = 360,
  quality: number = 0.85
): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('File yang dipilih harus berupa gambar (JPG, PNG, WebP).'));
    }

    // Batasi ukuran input awal (misal max 15MB)
    if (file.size > 15 * 1024 * 1024) {
      return reject(new Error('Ukuran file terlalu besar. Maksimal 15 MB.'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format gambar tidak didukung.'));
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return reject(new Error('Browser tidak mendukung canvas rendering.'));
          }

          // Hitung pemotongan tengah 1:1 (Center Square Crop)
          const minSide = Math.min(img.width, img.height);
          const startX = (img.width - minSide) / 2;
          const startY = (img.height - minSide) / 2;

          const targetSize = Math.min(minSide, maxDimension);
          canvas.width = targetSize;
          canvas.height = targetSize;

          // Background putih halus sebelum render
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, targetSize, targetSize);

          // Gambar crop persegi
          ctx.drawImage(
            img,
            startX,
            startY,
            minSide,
            minSide,
            0,
            0,
            targetSize,
            targetSize
          );

          // Ekspor sebagai JPEG base64 berkualitas tinggi namun efisien
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
};

const createSvgUri = (svgContent: string): string => {
  const cleanSvg = svgContent.replace(/\s+/g, ' ').trim();
  return `data:image/svg+xml;utf8,${encodeURIComponent(cleanSvg)}`;
};

/**
 * Koleksi Preset Avatar Olahraga & Siswa PJOK
 */
export const AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: 'siswa-putra',
    name: 'Siswa Putra',
    category: 'Pelajar',
    svgDataUri: createSvgUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <rect width="100" height="100" rx="50" fill="#2563EB"/>
        <circle cx="50" cy="40" r="20" fill="#FED7AA"/>
        <!-- Rambut Putra -->
        <path d="M30 36 C30 20, 70 20, 70 36 C65 24, 35 24, 30 36 Z" fill="#1E293B"/>
        <path d="M28 32 C34 18, 66 18, 72 32 C68 22, 32 22, 28 32 Z" fill="#0F172A"/>
        <!-- Mata & Senyum -->
        <circle cx="43" cy="38" r="2.5" fill="#1E293B"/>
        <circle cx="57" cy="38" r="2.5" fill="#1E293B"/>
        <path d="M44 47 Q50 52 56 47" stroke="#9A3412" stroke-width="2" fill="none" stroke-linecap="round"/>
        <!-- Kaos Olahraga PJOK -->
        <path d="M20 90 C20 66, 80 66, 80 90 Z" fill="#3B82F6"/>
        <path d="M40 68 L50 82 L60 68 Z" fill="#FFFFFF"/>
        <circle cx="50" cy="74" r="3" fill="#F59E0B"/>
      </svg>
    `)
  },
  {
    id: 'siswi-putri',
    name: 'Siswi Putri',
    category: 'Pelajar',
    svgDataUri: createSvgUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <rect width="100" height="100" rx="50" fill="#0D9488"/>
        <!-- Rambut Panjang -->
        <path d="M26 38 C24 60, 32 70, 36 72 C30 50, 35 30, 45 22 C65 22, 70 34, 64 72 C68 70, 76 60, 74 38 Z" fill="#334155"/>
        <circle cx="50" cy="40" r="19" fill="#FED7AA"/>
        <!-- Poni Putri -->
        <path d="M32 34 C40 24, 60 24, 68 34 C60 26, 40 26, 32 34 Z" fill="#1E293B"/>
        <!-- Mata & Senyum -->
        <circle cx="44" cy="39" r="2.5" fill="#1E293B"/>
        <circle cx="56" cy="39" r="2.5" fill="#1E293B"/>
        <path d="M44 48 Q50 53 56 48" stroke="#BE185D" stroke-width="2" fill="none" stroke-linecap="round"/>
        <!-- Kaos Olahraga PJOK -->
        <path d="M22 90 C22 66, 78 66, 78 90 Z" fill="#14B8A6"/>
        <path d="M42 68 L50 80 L58 68 Z" fill="#CCFBF1"/>
      </svg>
    `)
  },
  {
    id: 'basket',
    name: 'Pemain Basket',
    category: 'Bola Besar',
    svgDataUri: createSvgUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <rect width="100" height="100" rx="50" fill="#EA580C"/>
        <!-- Bola Basket -->
        <circle cx="50" cy="50" r="38" fill="#F97316"/>
        <circle cx="50" cy="50" r="38" fill="none" stroke="#7C2D12" stroke-width="4"/>
        <line x1="12" y1="50" x2="88" y2="50" stroke="#7C2D12" stroke-width="3.5"/>
        <line x1="50" y1="12" x2="50" y2="88" stroke="#7C2D12" stroke-width="3.5"/>
        <path d="M23 23 Q50 50 23 77" stroke="#7C2D12" stroke-width="3.5" fill="none"/>
        <path d="M77 23 Q50 50 77 77" stroke="#7C2D12" stroke-width="3.5" fill="none"/>
      </svg>
    `)
  },
  {
    id: 'sepakbola',
    name: 'Sepak Bola / Futsal',
    category: 'Bola Besar',
    svgDataUri: createSvgUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <rect width="100" height="100" rx="50" fill="#16A34A"/>
        <!-- Bola Sepak -->
        <circle cx="50" cy="50" r="38" fill="#F8FAFC" stroke="#0F172A" stroke-width="3"/>
        <!-- Pentagon Tengah -->
        <polygon points="50,38 60,45 56,58 44,58 40,45" fill="#0F172A"/>
        <!-- Garis & Poligon Tepi -->
        <line x1="50" y1="38" x2="50" y2="20" stroke="#0F172A" stroke-width="2.5"/>
        <line x1="60" y1="45" x2="76" y2="38" stroke="#0F172A" stroke-width="2.5"/>
        <line x1="56" y1="58" x2="68" y2="76" stroke="#0F172A" stroke-width="2.5"/>
        <line x1="44" y1="58" x2="32" y2="76" stroke="#0F172A" stroke-width="2.5"/>
        <line x1="40" y1="45" x2="24" y2="38" stroke="#0F172A" stroke-width="2.5"/>
      </svg>
    `)
  },
  {
    id: 'voli',
    name: 'Bola Voli',
    category: 'Bola Besar',
    svgDataUri: createSvgUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <rect width="100" height="100" rx="50" fill="#0284C7"/>
        <!-- Bola Voli -->
        <circle cx="50" cy="50" r="38" fill="#F8FAFC" stroke="#0369A1" stroke-width="3"/>
        <path d="M50 12 C40 30, 40 45, 50 50 C60 45, 60 30, 50 12 Z" fill="#FACC15" stroke="#0369A1" stroke-width="2"/>
        <path d="M15 65 C32 60, 44 54, 50 50 C44 42, 30 38, 17 40 Z" fill="#0284C7" stroke="#0369A1" stroke-width="2"/>
        <path d="M85 65 C68 60, 56 54, 50 50 C56 42, 70 38, 83 40 Z" fill="#FACC15" stroke="#0369A1" stroke-width="2"/>
        <path d="M30 82 C42 68, 48 58, 50 50 C55 58, 62 70, 70 82 Z" fill="#0284C7" stroke="#0369A1" stroke-width="2"/>
      </svg>
    `)
  },
  {
    id: 'bulutangkis',
    name: 'Bulu Tangkis',
    category: 'Bola Kecil',
    svgDataUri: createSvgUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <rect width="100" height="100" rx="50" fill="#7C3AED"/>
        <!-- Shuttlecock (Kok) -->
        <circle cx="50" cy="70" r="11" fill="#F8FAFC" stroke="#475569" stroke-width="2"/>
        <path d="M39 63 L28 26 C42 30, 58 30, 72 26 L61 63 Z" fill="#EDE9FE" stroke="#6D28D9" stroke-width="2.5"/>
        <line x1="39" y1="46" x2="61" y2="46" stroke="#8B5CF6" stroke-width="2"/>
        <line x1="45" y1="28" x2="47" y2="63" stroke="#8B5CF6" stroke-width="1.5"/>
        <line x1="55" y1="28" x2="53" y2="63" stroke="#8B5CF6" stroke-width="1.5"/>
      </svg>
    `)
  },
  {
    id: 'atletik',
    name: 'Pelari / Atletik',
    category: 'Kebugaran',
    svgDataUri: createSvgUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <rect width="100" height="100" rx="50" fill="#DC2626"/>
        <!-- Sosok Pelari -->
        <circle cx="58" cy="24" r="8" fill="#FEF08A"/>
        <path d="M42 42 L56 36 L68 46 L80 40" stroke="#FEF08A" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <path d="M56 36 L48 54 L32 58" stroke="#FEF08A" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <path d="M48 54 L62 66 L58 84" stroke="#FEF08A" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <path d="M48 54 L34 68 L20 64" stroke="#FEF08A" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      </svg>
    `)
  },
  {
    id: 'senam',
    name: 'Senam & Yoga',
    category: 'Kebugaran',
    svgDataUri: createSvgUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <rect width="100" height="100" rx="50" fill="#4F46E5"/>
        <!-- Siluet Meditasi / Kebugaran -->
        <circle cx="50" cy="26" r="8" fill="#FDE047"/>
        <path d="M50 35 L50 60" stroke="#FDE047" stroke-width="5" stroke-linecap="round"/>
        <!-- Tangan -->
        <path d="M26 50 Q36 38 50 42 Q64 38 74 50" stroke="#FDE047" stroke-width="4.5" fill="none" stroke-linecap="round"/>
        <!-- Kaki Teratai -->
        <path d="M22 68 Q50 82 78 68" stroke="#FDE047" stroke-width="5" fill="none" stroke-linecap="round"/>
        <circle cx="26" cy="50" r="3" fill="#FDE047"/>
        <circle cx="74" cy="50" r="3" fill="#FDE047"/>
      </svg>
    `)
  },
  {
    id: 'renang',
    name: 'Renang',
    category: 'Aktivitas Air',
    svgDataUri: createSvgUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <rect width="100" height="100" rx="50" fill="#0891B2"/>
        <!-- Perenang -->
        <circle cx="68" cy="34" r="7" fill="#FEF08A"/>
        <path d="M25 50 L48 40 L64 37" stroke="#FEF08A" stroke-width="4.5" stroke-linecap="round" fill="none"/>
        <path d="M48 40 L38 24 L20 28" stroke="#FEF08A" stroke-width="4.5" stroke-linecap="round" fill="none"/>
        <!-- Gelombang Air -->
        <path d="M12 65 Q25 55 38 65 T64 65 T90 65" stroke="#E0F2FE" stroke-width="4.5" fill="none" stroke-linecap="round"/>
        <path d="M16 80 Q29 72 42 80 T68 80 T94 80" stroke="#BAE6FD" stroke-width="4.5" fill="none" stroke-linecap="round"/>
      </svg>
    `)
  },
  {
    id: 'juara',
    name: 'Juara / Medali',
    category: 'Prestasi',
    svgDataUri: createSvgUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <rect width="100" height="100" rx="50" fill="#D97706"/>
        <!-- Pita Medali -->
        <polygon points="34,14 42,42 50,42 42,14" fill="#DC2626"/>
        <polygon points="66,14 58,42 50,42 58,14" fill="#2563EB"/>
        <!-- Medali Emas -->
        <circle cx="50" cy="58" r="26" fill="#FACC15" stroke="#B45309" stroke-width="3"/>
        <circle cx="50" cy="58" r="20" fill="#FDE047" stroke="#CA8A04" stroke-width="2"/>
        <!-- Bintang Juara -->
        <polygon points="50,44 53,52 61,52 55,57 57,65 50,60 43,65 45,57 39,52 47,52" fill="#B45309"/>
      </svg>
    `)
  }
];
