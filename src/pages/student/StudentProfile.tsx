import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DatabaseService } from '../../services/db';
import { UserProfile, AssessmentRecord } from '../../types';
import { AVATAR_PRESETS, compressImageFile } from '../../utils/avatarUtils';
import { auth } from '../../lib/firebase';
import { updatePassword, updateProfile } from 'firebase/auth';
import {
  User,
  GraduationCap,
  LogOut,
  ShieldCheck,
  CheckCircle2,
  Lightbulb,
  Camera,
  KeyRound,
  Eye,
  EyeOff,
  Upload,
  Trash2,
  Sparkles,
  AlertCircle,
  Loader2,
  Check,
  X,
  Lock,
  Image as ImageIcon
} from 'lucide-react';

export const StudentProfile: React.FC = () => {
  const { user, logout, setCurrentUser } = useAuth();

  // Metrics
  const [assessmentsGivenCount, setAssessmentsGivenCount] = useState(0);
  const [assessmentsReceivedCount, setAssessmentsReceivedCount] = useState(0);
  const [averageReceivedScore, setAverageReceivedScore] = useState<string>('0.00');

  // Modals state
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  // Photo state
  const [photoTab, setPhotoTab] = useState<'upload' | 'presets'>('upload');
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password state
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;
      const records = await DatabaseService.getAssessments();
      const given = records.filter(
        (r) =>
          r.assessorUserId === user.uid ||
          r.assessorName.toLowerCase() === user.nama.toLowerCase()
      );
      const received = records.filter(
        (r) =>
          r.targetUserId === user.uid ||
          r.targetName.toLowerCase() === user.nama.toLowerCase()
      );

      setAssessmentsGivenCount(given.length);
      setAssessmentsReceivedCount(received.length);

      if (received.length > 0) {
        const sum = received.reduce((acc, curr) => acc + (curr.averageScore || 0), 0);
        setAverageReceivedScore((sum / received.length).toFixed(2));
      }
    };

    fetchStats();
  }, [user]);

  // Handle open photo modal
  const handleOpenPhotoModal = () => {
    setPreviewPhoto(user?.fotoProfil || null);
    setSelectedPresetId(null);
    setPhotoError(null);
    setIsPhotoModalOpen(true);
  };

  // Handle file select & compression
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoError(null);
    try {
      const compressedBase64 = await compressImageFile(file, 360, 0.85);
      setPreviewPhoto(compressedBase64);
      setSelectedPresetId(null);
    } catch (err: any) {
      setPhotoError(err.message || 'Gagal memproses file foto.');
    }
  };

  // Handle preset avatar click
  const handleSelectPreset = (preset: typeof AVATAR_PRESETS[0]) => {
    setSelectedPresetId(preset.id);
    setPreviewPhoto(preset.svgDataUri);
    setPhotoError(null);
  };

  // Handle remove photo (reset to initial)
  const handleRemovePhoto = () => {
    setPreviewPhoto('');
    setSelectedPresetId(null);
    setPhotoError(null);
  };

  // Save photo to database & context
  const handleSavePhoto = async () => {
    if (!user) return;
    setIsSavingPhoto(true);
    setPhotoError(null);

    try {
      const updatedPhoto = previewPhoto === '' ? '' : (previewPhoto || '');
      const updatedUser: UserProfile = {
        ...user,
        fotoProfil: updatedPhoto
      };

      // Simpan ke Firestore dan localStorage
      await DatabaseService.saveUser(updatedUser);

      // Sinkronkan ke Firebase Auth profile jika sesi auth aktif
      if (auth && auth.currentUser) {
        try {
          await updateProfile(auth.currentUser, {
            photoURL: updatedPhoto || null
          });
        } catch (e) {
          console.warn('Catatan: updateProfile Firebase Auth opsional:', e);
        }
      }

      setCurrentUser(updatedUser);
      setIsPhotoModalOpen(false);
      showToast(
        updatedPhoto
          ? 'Foto profil berhasil diperbarui!'
          : 'Foto profil telah dihapus (kembali ke inisial).'
      );
    } catch (err: any) {
      console.error('Gagal menyimpan foto profil:', err);
      setPhotoError('Gagal menyimpan foto profil. Silakan coba lagi.');
    } finally {
      setIsSavingPhoto(false);
    }
  };

  // Open password modal
  const handleOpenPasswordModal = () => {
    setCurrentPasswordInput('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
    setIsPasswordModalOpen(true);
  };

  // Save password
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setPasswordError(null);

    // Validasi panjang kata sandi
    if (newPassword.length < 6) {
      setPasswordError('Kata sandi baru minimal harus 6 karakter.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Konfirmasi kata sandi tidak cocok dengan kata sandi baru.');
      return;
    }

    // Jika murid sudah memiliki password tersimpan sebelumnya, pastikan sandi saat ini cocok
    const existingPassword = user.password || '123456';
    if (currentPasswordInput.trim() && currentPasswordInput !== existingPassword) {
      setPasswordError('Kata sandi saat ini tidak sesuai.');
      return;
    }

    setIsSavingPassword(true);

    try {
      const updatedUser: UserProfile = {
        ...user,
        password: newPassword
      };

      // Simpan ke Firestore (koleksi pengguna & users) dan database lokal
      await DatabaseService.saveUser(updatedUser);

      // Coba perbarui kata sandi di Firebase Auth jika user masuk dengan email/pass
      if (auth && auth.currentUser && auth.currentUser.email) {
        try {
          await updatePassword(auth.currentUser, newPassword);
        } catch (fbErr: any) {
          console.warn('Catatan Firebase Auth updatePassword:', fbErr?.code || fbErr?.message);
        }
      }

      setCurrentUser(updatedUser);
      setIsPasswordModalOpen(false);
      showToast('Kata sandi akun murid berhasil diperbarui!');
    } catch (err: any) {
      console.error('Gagal memperbarui kata sandi:', err);
      setPasswordError('Terjadi kendala saat menyimpan kata sandi. Silakan coba lagi.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  // Password strength helper
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, text: '', color: 'bg-slate-200' };
    if (pass.length < 6) return { score: 1, text: 'Kurang (min. 6 karakter)', color: 'bg-rose-500' };
    const hasLetters = /[a-zA-Z]/.test(pass);
    const hasNumbers = /[0-9]/.test(pass);
    const hasSpecial = /[^a-zA-Z0-9]/.test(pass);

    if (pass.length >= 8 && hasLetters && hasNumbers && hasSpecial) {
      return { score: 4, text: 'Sangat Kuat', color: 'bg-emerald-500' };
    }
    if (pass.length >= 6 && hasLetters && hasNumbers) {
      return { score: 3, text: 'Kuat', color: 'bg-teal-500' };
    }
    return { score: 2, text: 'Sedang', color: 'bg-amber-500' };
  };

  const strength = getPasswordStrength(newPassword);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`p-4 rounded-2xl border text-sm font-semibold flex items-center justify-between gap-3 shadow-md animate-in fade-in slide-in-from-top-2 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 hover:bg-black/5 rounded-lg text-slate-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Profile Header Card */}
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-8 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs text-center relative overflow-hidden transition-colors">
        {/* Avatar with Camera Button */}
        <div className="relative inline-block mx-auto mb-4">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-linear-to-tr from-teal-600 via-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-3xl sm:text-4xl shadow-xl shadow-teal-600/20 overflow-hidden border-3 border-white dark:border-slate-800">
            {user?.fotoProfil ? (
              <img
                src={user.fotoProfil}
                alt={user.nama}
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{user?.nama ? user.nama.charAt(0) : 'M'}</span>
            )}
          </div>

          <button
            type="button"
            onClick={handleOpenPhotoModal}
            className="absolute -bottom-1.5 -right-1.5 p-2 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-600/30 transition-transform active:scale-95 cursor-pointer border-2 border-white dark:border-slate-900"
            title="Ubah Foto Profil"
            aria-label="Ubah Foto Profil"
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>

        <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-heading">
          {user?.nama || 'Nama Siswa'}
        </h2>
        <p className="text-xs sm:text-sm font-semibold text-teal-600 dark:text-teal-400 mt-0.5">
          Murid Kelas {user?.kelas || 'XI 7'} &bull; Nomor Absen {user?.nomorAbsen || '01'}
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-1">NIS: {user?.nis || '-'}</p>

        {/* Quick Action Buttons for Photo & Password */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 mt-5">
          <button
            type="button"
            onClick={handleOpenPhotoModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:hover:bg-teal-900/60 dark:text-teal-300 text-xs font-bold transition-colors cursor-pointer border border-teal-200 dark:border-teal-800"
          >
            <Camera className="w-4 h-4" />
            <span>Ganti Foto Profil</span>
          </button>

          <button
            type="button"
            onClick={handleOpenPasswordModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
          >
            <KeyRound className="w-4 h-4 text-amber-500" />
            <span>Ubah Kata Sandi</span>
          </button>
        </div>

        {/* 3 Metrics */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-5 sm:pt-6 mt-5 sm:mt-6 border-t border-slate-100 dark:border-slate-800 text-center">
          <div className="p-2.5 sm:p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
              Menilai
            </span>
            <span className="text-base sm:text-xl font-black text-slate-800 dark:text-slate-100 font-heading">
              {assessmentsGivenCount}
            </span>
            <span className="text-[10px] text-slate-400 block">Teman</span>
          </div>

          <div className="p-2.5 sm:p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
              Dinilai
            </span>
            <span className="text-base sm:text-xl font-black text-slate-800 dark:text-slate-100 font-heading">
              {assessmentsReceivedCount}
            </span>
            <span className="text-[10px] text-slate-400 block">Kali</span>
          </div>

          <div className="p-2.5 sm:p-3 bg-teal-50 dark:bg-teal-950/40 rounded-2xl">
            <span className="text-[10px] font-bold text-teal-700 dark:text-teal-300 uppercase tracking-wider block mb-0.5">
              Rata-Rata
            </span>
            <span className="text-base sm:text-xl font-black text-teal-700 dark:text-teal-300 font-heading">
              {averageReceivedScore}
            </span>
            <span className="text-[10px] text-teal-600 dark:text-teal-400 block">Skala 4</span>
          </div>
        </div>
      </div>

      {/* Account Credentials Summary Card */}
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-sm font-heading">
                Keamanan & Informasi Akun
              </h3>
              <p className="text-xs text-slate-400">
                Data akses akun murid pada aplikasi penilaian PJOK
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-slate-400 block text-[11px] mb-0.5">Username / NIS Login</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">
              {user?.nis || user?.email || '-'}
            </span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-slate-400 block text-[11px] mb-0.5">Status Kata Sandi</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {user?.password && user.password !== '123456' ? (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Kustom & Aman
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Standar (123456)
                  </span>
                )}
              </span>
            </div>
            <button
              type="button"
              onClick={handleOpenPasswordModal}
              className="px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs"
            >
              Ubah
            </button>
          </div>
        </div>
      </div>

      {/* Guide to Peer Assessment */}
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Lightbulb className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 dark:text-white text-sm font-heading">
              Panduan Penilaian Antar Teman (Peer Assessment)
            </h3>
            <p className="text-xs text-slate-400">
              Prinsip dan cara menilai yang baik dalam pembelajaran PJOK
            </p>
          </div>
        </div>

        <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
            <p>
              <strong>Objektif & Jujur:</strong> Nilai gerakan teman berdasarkan ketercapaian rubrik indikator gerak jasmani, bukan karena rasa sungkan atau kedekatan personal.
            </p>
          </div>

          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
            <p>
              <strong>Konstruktif:</strong> Tuliskan masukan yang membantu teman memperbaiki posisi kaki, tangan, pandangan, atau keseimbangan saat mempraktikkan gerak.
            </p>
          </div>

          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
            <p>
              <strong>Saling Menghargai:</strong> Gunakan bahasa yang sopan dan santun. Belajar menilai juga membantu kita memahami teknik gerak yang benar.
            </p>
          </div>
        </div>
      </div>

      {/* Logout Action */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex items-center justify-between transition-colors">
        <div>
          <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm">
            Keluar dari Akun Siswa
          </h4>
          <p className="text-[11px] text-slate-400">
            Sesi kamu akan disimpan dengan aman
          </p>
        </div>

        <button
          onClick={() => {
            if (window.confirm('Apakah kamu yakin ingin keluar dari akun?')) {
              logout();
            }
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-bold transition-colors cursor-pointer border border-rose-200 dark:border-rose-900"
        >
          <LogOut className="w-4 h-4" />
          <span>Keluar Akun</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* MODAL GANTI FOTO PROFIL */}
      {/* ========================================================= */}
      {isPhotoModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-5 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base font-heading">
                    Ganti Foto Profil
                  </h3>
                  <p className="text-xs text-slate-400">
                    Pilih foto dari perangkat atau avatar olahraga PJOK
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPhotoModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Photo Preview Center */}
            <div className="flex flex-col items-center justify-center py-2">
              <div className="w-28 h-28 rounded-3xl bg-linear-to-tr from-teal-600 via-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-4xl shadow-xl shadow-teal-600/20 overflow-hidden border-4 border-slate-100 dark:border-slate-800">
                {previewPhoto ? (
                  <img
                    src={previewPhoto}
                    alt="Pratinjau Foto"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{user?.nama ? user.nama.charAt(0) : 'M'}</span>
                )}
              </div>
              <span className="text-xs font-semibold text-slate-500 mt-2">
                Pratinjau Foto Profil
              </span>
              {previewPhoto && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus foto (gunakan inisial)</span>
                </button>
              )}
            </div>

            {photoError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{photoError}</span>
              </div>
            )}

            {/* Mode Tabs: Upload vs Preset */}
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
              <button
                type="button"
                onClick={() => setPhotoTab('upload')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  photoTab === 'upload'
                    ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Unggah Foto Sendiri</span>
              </button>
              <button
                type="button"
                onClick={() => setPhotoTab('presets')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  photoTab === 'presets'
                    ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Pilih Avatar Olahraga</span>
              </button>
            </div>

            {/* Tab 1: Upload from device */}
            {photoTab === 'upload' && (
              <div className="space-y-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-teal-500 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-800/30 hover:bg-teal-50/20"
                >
                  <div className="w-12 h-12 rounded-2xl bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto mb-2 shadow-2xs">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                    Klik untuk memilih foto dari galeri atau kamera
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Mendukung JPG, PNG, WebP (otomatis dioptimasi persegi 1:1)
                  </p>
                </div>
              </div>
            )}

            {/* Tab 2: Preset Athletic Avatars */}
            {photoTab === 'presets' && (
              <div className="space-y-2">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Pilih salah satu karakter olahraga di bawah ini:
                </p>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2.5 max-h-56 overflow-y-auto p-1">
                  {AVATAR_PRESETS.map((preset) => {
                    const isSelected = previewPhoto === preset.svgDataUri;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPreset(preset)}
                        className={`p-1.5 rounded-2xl border-2 transition-all flex flex-col items-center gap-1 text-center cursor-pointer group ${
                          isSelected
                            ? 'border-teal-600 bg-teal-50/60 dark:bg-teal-950/60 ring-2 ring-teal-500/30'
                            : 'border-slate-200 dark:border-slate-700 hover:border-teal-400 bg-slate-50 dark:bg-slate-800'
                        }`}
                        title={preset.name}
                      >
                        <div className="w-12 h-12 rounded-xl overflow-hidden shadow-2xs group-hover:scale-105 transition-transform">
                          <img
                            src={preset.svgDataUri}
                            alt={preset.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate max-w-full">
                          {preset.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={isSavingPhoto}
                onClick={() => setIsPhotoModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSavingPhoto}
                onClick={handleSavePhoto}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-teal-600/20 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSavingPhoto ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Simpan Foto Profil</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL RUBAH KATA SANDI (PASSWORD) */}
      {/* ========================================================= */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base font-heading">
                    Ubah Kata Sandi Akun
                  </h3>
                  <p className="text-xs text-slate-400">
                    Perbarui kata sandi untuk keamanan akun siswa
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {passwordError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleSavePassword} className="space-y-3.5">
              {/* Kata Sandi Lama / Saat Ini (Opsional jika baru pertama kali) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Kata Sandi Saat Ini <span className="font-normal text-slate-400">(Bawaan: 123456)</span>
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPasswordInput}
                    onChange={(e) => setCurrentPasswordInput(e.target.value)}
                    placeholder="Masukkan sandi saat ini"
                    className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-teal-500 focus:outline-hidden font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Kata Sandi Baru */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Kata Sandi Baru <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    required
                    minLength={6}
                    className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-teal-500 focus:outline-hidden font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                {newPassword && (
                  <div className="mt-1.5 space-y-1">
                    <div className="flex items-center gap-1 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${strength.color} transition-all duration-300`}
                        style={{ width: `${(strength.score / 4) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 font-semibold block">
                      Kekuatan: {strength.text}
                    </span>
                  </div>
                )}
              </div>

              {/* Konfirmasi Kata Sandi Baru */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Ulangi Kata Sandi Baru <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ketik ulang kata sandi baru"
                    required
                    minLength={6}
                    className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-teal-500 focus:outline-hidden font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-[11px] text-rose-500 font-semibold mt-1">
                    Konfirmasi kata sandi belum cocok.
                  </p>
                )}
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl text-[11px] text-amber-800 dark:text-amber-300">
                💡 <strong>Catatan:</strong> Ingat kata sandi baru Anda dengan baik. Kata sandi ini akan digunakan setiap kali Anda masuk ke akun murid dengan NIS atau Email.
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={isSavingPassword}
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingPassword || !newPassword || newPassword !== confirmPassword}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-teal-600/20 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSavingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Simpan Kata Sandi</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
