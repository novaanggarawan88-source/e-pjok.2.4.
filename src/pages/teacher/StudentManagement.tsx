import React, { useState, useEffect } from 'react';
import { DatabaseService, subscribeToDataChanges } from '../../services/db';
import { UserProfile, ClassItem } from '../../types';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Upload,
  CheckCircle,
  XCircle,
  X,
  FileSpreadsheet,
  Download,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Info,
  CheckSquare,
  Square,
  AlertTriangle,
  Loader2
} from 'lucide-react';

export const StudentManagement: React.FC = () => {
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('Semua');
  
  // Selection states for bulk actions (Kotak Centang)
  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<UserProfile | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [notification, setNotification] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  // Form inputs
  const [nama, setNama] = useState('');
  const [nis, setNis] = useState('');
  const [kelas, setKelas] = useState('');
  const [nomorAbsen, setNomorAbsen] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'aktif' | 'nonaktif'>('aktif');

  const loadData = async () => {
    const [u, c] = await Promise.all([
      DatabaseService.getUsers(),
      DatabaseService.getClasses()
    ]);
    setStudents(u.filter((x) => x.role === 'murid'));
    setClasses(c);
  };

  useEffect(() => {
    loadData();
    const unsub = subscribeToDataChanges(loadData);
    return () => unsub();
  }, []);

  const openAddModal = () => {
    setEditingStudent(null);
    setNama('');
    setNis('');
    setKelas(classes[0]?.nama || 'XI 7');
    setNomorAbsen('');
    setEmail('');
    setPassword('123456');
    setStatus('aktif');
    setIsFormOpen(true);
  };

  const openEditModal = (student: UserProfile) => {
    setEditingStudent(student);
    setNama(student.nama);
    setNis(student.nis || '');
    setKelas(student.kelas || classes[0]?.nama || 'XI 7');
    setNomorAbsen(student.nomorAbsen || '');
    setEmail(student.email);
    setPassword(student.password || '123456');
    setStatus(student.status);
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim()) return;

    const studentToSave: UserProfile = {
      uid: editingStudent ? editingStudent.uid : `murid-${Date.now()}`,
      nama: nama.trim(),
      email: email.trim() || `${nama.toLowerCase().replace(/\s+/g, '')}@pjok.sch.id`,
      password: password.trim() || '123456',
      role: 'murid',
      kelas,
      nomorAbsen: nomorAbsen.trim(),
      nis: nis.trim(),
      status,
      createdAt: editingStudent?.createdAt || new Date().toISOString()
    };

    await DatabaseService.saveUser(studentToSave);
    setIsFormOpen(false);
    showNotice(editingStudent ? 'Data dan kredensial murid berhasil diperbarui' : 'Murid baru berhasil ditambahkan');
  };

  const handleDelete = async (uid: string, name: string) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus data murid: ${name}?`)) {
      await DatabaseService.deleteUser(uid);
      setSelectedUids((prev) => prev.filter((id) => id !== uid));
      showNotice('Data murid berhasil dihapus');
    }
  };

  const handleToggleStudentSelect = (uid: string) => {
    setSelectedUids((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleClearSelection = () => {
    setSelectedUids([]);
  };

  const handleExecuteBulkDelete = async () => {
    if (selectedUids.length === 0) return;
    setIsDeleting(true);
    try {
      const count = selectedUids.length;
      await DatabaseService.deleteUsers(selectedUids);
      setSelectedUids([]);
      setIsBulkDeleteModalOpen(false);
      showNotice(`Berhasil menghapus ${count} data murid secara permanen`);
    } catch (err) {
      console.error('Gagal menghapus murid secara massal:', err);
      showNotice('Terjadi kesalahan saat menghapus data murid.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleStatus = async (student: UserProfile) => {
    const updatedStatus = student.status === 'aktif' ? 'nonaktif' : 'aktif';
    await DatabaseService.saveUser({ ...student, status: updatedStatus });
    showNotice(`Status murid diubah menjadi ${updatedStatus}`);
  };

  const togglePasswordVisibility = (uid: string) => {
    setShowPasswords((prev) => ({ ...prev, [uid]: !prev[uid] }));
  };

  const CSV_TEMPLATE_CONTENT =
    'Nama,NIS,Kelas,No Absen,Email/Username,Password\n' +
    'Andi Pratama,1001,XI 7,01,andi@pjok.sch.id,123456\n' +
    'Budi Santoso,1002,XI 7,02,budi@pjok.sch.id,123456\n' +
    'Citra Lestari,1003,XI 7,03,citra@pjok.sch.id,123456\n' +
    'Dewi Anggraini,1004,XI 7,04,dewi@pjok.sch.id,123456\n' +
    'Eko Prasetyo,1005,XI 7,05,eko@pjok.sch.id,123456\n';

  const handleDownloadCsvTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE_CONTENT], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'format_data_murid_pjok.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotice('Format file CSV murid berhasil diunduh');
  };

  const handleCopyTemplate = () => {
    navigator.clipboard.writeText(CSV_TEMPLATE_CONTENT);
    showNotice('Format template CSV disalin ke clipboard');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text) {
        setCsvText(text);
        showNotice('Berkas CSV berhasil dimuat');
      }
    };
    reader.readAsText(file);
  };

  const handleImportCsv = async () => {
    if (!csvText.trim()) return;
    const lines = csvText.trim().split('\n');
    let importedCount = 0;

    for (const line of lines) {
      // Expecting format: Nama, NIS, Kelas, No Absen, Email, Password (opsional)
      const parts = line.split(',').map((p) => p.trim());
      if (parts.length >= 3) {
        const [namaVal, nisVal, kelasVal, noAbsenVal, emailVal, passVal] = parts;
        if (namaVal.toLowerCase() === 'nama' || namaVal.toLowerCase().includes('nama')) continue; // Header row

        const newStudent: UserProfile = {
          uid: `murid-import-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          nama: namaVal,
          nis: nisVal || '',
          kelas: kelasVal || 'XI 7',
          nomorAbsen: noAbsenVal || '',
          email: emailVal || `${namaVal.toLowerCase().replace(/\s+/g, '')}@pjok.sch.id`,
          password: passVal || '123456',
          role: 'murid',
          status: 'aktif',
          createdAt: new Date().toISOString()
        };
        await DatabaseService.saveUser(newStudent);
        importedCount++;
      }
    }

    setIsImportOpen(false);
    setCsvText('');
    showNotice(`Berhasil mengimpor ${importedCount} data murid dengan kredensial!`);
  };

  const showNotice = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // Filter & search
  const filteredStudents = students.filter((s) => {
    const matchQuery =
      s.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.nis && s.nis.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.email && s.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.kelas && s.kelas.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchClass = selectedClass === 'Semua' || s.kelas === selectedClass;
    return matchQuery && matchClass;
  });

  const isAllFilteredSelected =
    filteredStudents.length > 0 &&
    filteredStudents.every((s) => selectedUids.includes(s.uid));

  const isSomeFilteredSelected =
    filteredStudents.some((s) => selectedUids.includes(s.uid)) &&
    !isAllFilteredSelected;

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      const filteredUids = new Set(filteredStudents.map((s) => s.uid));
      setSelectedUids((prev) => prev.filter((id) => !filteredUids.has(id)));
    } else {
      const newUids = new Set([...selectedUids, ...filteredStudents.map((s) => s.uid)]);
      setSelectedUids(Array.from(newUids));
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast notification */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-sm animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-blue-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 font-heading">
            Data & Kredensial Murid
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Kelola identitas, username/email, password, dan status siswa peserta asesmen PJOK
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsTemplateModalOpen(true)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-semibold shadow-2xs transition-colors cursor-pointer"
            title="Lihat format CSV data murid"
          >
            <FileSpreadsheet className="w-4 h-4 text-blue-600" />
            <span>Format CSV</span>
          </button>

          <button
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <Upload className="w-4 h-4 text-slate-500" />
            <span>Import CSV</span>
          </button>

          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-600/20 transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Tambah Murid</span>
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama, NIS, username, atau kelas..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Filter Kelas:</span>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full sm:w-44 py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 cursor-pointer"
          >
            <option value="Semua">Semua Kelas ({students.length})</option>
            {classes.map((c) => (
              <option key={c.id} value={c.nama}>
                Kelas {c.nama}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Bulk Action Bar (Muncul saat ada murid yang dicentang) */}
      {selectedUids.length > 0 && (
        <div className="bg-rose-50 border-2 border-rose-200 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
              {selectedUids.length}
            </div>
            <div>
              <p className="text-sm font-extrabold text-slate-900">
                {selectedUids.length} murid ditandai (dicentang)
              </p>
              <p className="text-xs text-slate-600">
                Gunakan tombol di samping untuk menghapus nama murid terpilih secara massal / banyak sekaligus.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              type="button"
              onClick={handleClearSelection}
              className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
            >
              Batal Pilih ({selectedUids.length})
            </button>

            <button
              type="button"
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-rose-600/20 transition-all cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Hapus {selectedUids.length} Murid Terpilih</span>
            </button>
          </div>
        </div>
      )}

      {/* Students Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    title={isAllFilteredSelected ? "Batal centang semua murid" : "Centang semua murid di daftar"}
                    checked={isAllFilteredSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isSomeFilteredSelected;
                    }}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                  />
                </th>
                <th className="py-3.5 px-3 w-12 text-center">NO</th>
                <th className="py-3.5 px-4">NAMA MURID</th>
                <th className="py-3.5 px-4">NIS</th>
                <th className="py-3.5 px-4">KELAS</th>
                <th className="py-3.5 px-4 text-center">ABSEN</th>
                <th className="py-3.5 px-4">USERNAME / EMAIL</th>
                <th className="py-3.5 px-4">PASSWORD</th>
                <th className="py-3.5 px-4 text-center">STATUS</th>
                <th className="py-3.5 px-4 text-center">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    Tidak ditemukan data murid yang sesuai.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s, idx) => {
                  const isSelected = selectedUids.includes(s.uid);
                  return (
                    <tr
                      key={s.uid}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-blue-50/90 hover:bg-blue-100/70 border-l-4 border-l-blue-600'
                          : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <td className="py-3.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleStudentSelect(s.uid)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                        />
                      </td>
                      <td className="py-3.5 px-3 text-center font-medium text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                            {s.nama.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{s.nama}</p>
                            <p className="text-[11px] text-slate-400 sm:hidden">NIS: {s.nis || '-'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {s.nis || '-'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700">
                          {s.kelas || '-'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                        {s.nomorAbsen || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono text-xs truncate max-w-[170px]">
                        {s.email}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                            {showPasswords[s.uid] ? (s.password || '123456') : '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(s.uid)}
                            className="p-1 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                            title={showPasswords[s.uid] ? 'Sembunyikan password' : 'Lihat password'}
                          >
                            {showPasswords[s.uid] ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleToggleStatus(s)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                            s.status === 'aktif'
                              ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                              : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                          }`}
                          title="Klik untuk ubah status"
                        >
                          {s.status === 'aktif' ? (
                            <>
                              <CheckCircle className="w-3 h-3" />
                              <span>Aktif</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3" />
                              <span>Nonaktif</span>
                            </>
                          )}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openEditModal(s)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Murid & Kredensial"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(s.uid, s.nama)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Murid"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Student Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-lg font-heading">
                {editingStudent ? 'Edit Data & Password Murid' : 'Tambah Murid Baru'}
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nama Lengkap Murid *
                </label>
                <input
                  type="text"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Contoh: Andi Pratama"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    NIS (Nomor Induk Siswa)
                  </label>
                  <input
                    type="text"
                    value={nis}
                    onChange={(e) => setNis(e.target.value)}
                    placeholder="Contoh: 1001"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Nomor Absen
                  </label>
                  <input
                    type="text"
                    value={nomorAbsen}
                    onChange={(e) => setNomorAbsen(e.target.value)}
                    placeholder="Contoh: 01"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Kelas *
                  </label>
                  <select
                    value={kelas}
                    onChange={(e) => setKelas(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.nama}>
                        {c.nama}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'aktif' | 'nonaktif')}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                  >
                    <option value="aktif">Aktif</option>
                    <option value="nonaktif">Nonaktif</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Email / Username Murid (Digunakan untuk Login)
                </label>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Contoh: andi@pjok.sch.id (atau otomatis dibuat jika kosong)"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Password Login Murid *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Contoh: 123456"
                    required
                    className="w-full pl-3.5 pr-24 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-hidden focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setPassword('123456')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 text-[11px] font-semibold bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg cursor-pointer"
                  >
                    Reset: 123456
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  * Murid dapat login dengan memasukkan NIS / Email ini dan password yang ditentukan.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md shadow-blue-600/20 cursor-pointer"
                >
                  {editingStudent ? 'Simpan Perubahan' : 'Tambah Murid'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Template Format CSV Info Modal */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                <h3 className="font-extrabold text-slate-800 text-lg font-heading">
                  Format Berkas CSV Data Murid
                </h3>
              </div>
              <button
                onClick={() => setIsTemplateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Anda dapat membuat berkas di Microsoft Excel, Google Sheets, atau Notepad dengan format kolom berikut:
              </p>

              <div className="p-3 bg-slate-900 text-slate-200 rounded-2xl font-mono text-[11px] overflow-x-auto whitespace-pre">
                {CSV_TEMPLATE_CONTENT}
              </div>

              <div className="space-y-1.5 text-slate-600">
                <p><strong>Penjelasan Kolom CSV:</strong></p>
                <ul className="list-disc pl-5 space-y-1 text-slate-500">
                  <li><strong>Nama:</strong> Nama lengkap murid (wajib)</li>
                  <li><strong>NIS:</strong> Nomor Induk Siswa (wajib/unik, dapat dipakai login)</li>
                  <li><strong>Kelas:</strong> Contoh &ldquo;XI 7&rdquo; atau &ldquo;X 1&rdquo;</li>
                  <li><strong>No Absen:</strong> Nomor presensi siswa (contoh &ldquo;01&rdquo;)</li>
                  <li><strong>Email/Username:</strong> Email login siswa</li>
                  <li><strong>Password:</strong> Kata sandi (jika kosong, otomatis diatur &ldquo;123456&rdquo;)</li>
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCopyTemplate}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  <Copy className="w-4 h-4 text-slate-500" />
                  <span>Salin Teks Format</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadCsvTemplate}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-600/20 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh File .CSV</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import CSV Modal */}
      {isImportOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                <h3 className="font-extrabold text-slate-800 text-lg font-heading">
                  Import Data Murid dari CSV
                </h3>
              </div>
              <button
                onClick={() => setIsImportOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-blue-950">Format Kolom CSV / Excel:</p>
                  <code className="text-[11px] text-blue-700 font-mono">
                    Nama, NIS, Kelas, No Absen, Email, Password
                  </code>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadCsvTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Contoh CSV</span>
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <label className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5 text-slate-500" />
                  <span>Pilih Berkas .CSV dari Perangkat</span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setCsvText(
                      `Fajar Nugroho, 1006, XI 7, 06, fajar@pjok.sch.id, 123456\nGilang Ramadhan, 1007, XI 7, 07, gilang@pjok.sch.id, 123456\nHana Pratiwi, 1008, XI 7, 08, hana@pjok.sch.id, 123456`
                    );
                  }}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 underline cursor-pointer"
                >
                  + Muat Sampel Teks
                </button>
              </div>

              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={`Atau tempel (paste) baris CSV di sini:\nNama, NIS, Kelas, No Absen, Email, Password\nAndi Pratama, 1001, XI 7, 01, andi@pjok.sch.id, 123456\nBudi Santoso, 1002, XI 7, 02, budi@pjok.sch.id, 123456`}
                rows={6}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono text-slate-800 focus:outline-hidden focus:bg-white focus:border-blue-600"
              />

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsImportOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleImportCsv}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md shadow-blue-600/20 cursor-pointer"
                >
                  Proses Import Data Murid
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Banyak Murid */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 font-heading">
                  Hapus {selectedUids.length} Data Murid Sekaligus?
                </h3>
                <p className="text-xs text-slate-500">
                  Konfirmasi penghapusan banyak nama murid
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50 border border-rose-200/80 rounded-2xl text-xs text-rose-800 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-rose-900">
                <span>⚠️</span> Peringatan Penghapusan Permanen:
              </p>
              <p>
                Sebanyak <strong className="text-rose-950">{selectedUids.length} akun murid</strong> yang dicentang akan dihapus dari sistem beserta akun kredensial login mereka. Murid yang dihapus tidak akan dapat masuk kembali.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Daftar Murid yang Akan Dihapus:</span>
                <span className="text-rose-600">{selectedUids.length} murid</span>
              </div>
              <div className="max-h-48 overflow-y-auto p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1 divide-y divide-slate-100">
                {students
                  .filter((s) => selectedUids.includes(s.uid))
                  .map((s, i) => (
                    <div key={s.uid} className="pt-1.5 first:pt-0 flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-800 truncate">
                        {i + 1}. {s.nama}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono shrink-0">
                        {s.kelas ? `Kelas ${s.kelas}` : '-'}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleExecuteBulkDelete}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-rose-600/20 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Ya, Hapus {selectedUids.length} Murid</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
