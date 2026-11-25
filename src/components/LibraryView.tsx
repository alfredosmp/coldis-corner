import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  Edit3,
  FileText,
  Heart,
  MoreVertical,
  Plus,
  Search,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { SUBJECT_COLOR_LIST, SUBJECT_COLORS } from '../data/subjectStyles';
import {
  detectBookFormat,
  formatFileSize,
  parseAndIndexDocument,
  type DocumentImportResult,
} from '../services/documentParser';
import type {
  BookFormat,
  BookItem,
  BookShelf,
  Subject,
  SubjectColorId,
} from '../types/models';
import { createId, normalizeText } from '../utils/text';
import { ColdiAvatar } from './ColdiAvatar';

interface LibraryViewProps {
  books: BookItem[];
  subjects: Subject[];
  animateMascot: boolean;
  quickUploadSignal?: { seq: number; subjectId?: string; shelf?: BookShelf };
  onImportBook: (
    book: BookItem,
    parsed: DocumentImportResult
  ) => Promise<void>;
  onUpdateBookMeta: (
    bookId: string,
    partial: Partial<Pick<BookItem, 'title' | 'author' | 'shelf' | 'subjectId' | 'coverColor' | 'isFavorite'>>
  ) => Promise<void>;
  onDeleteBook: (bookId: string) => Promise<void>;
  onOpenBook: (bookId: string, location?: number) => void;
}

const FORMAT_BADGE: Record<BookFormat, { label: string; style: string }> = {
  pdf: {
    label: 'PDF',
    style: 'bg-rose-100/90 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300',
  },
  docx: {
    label: 'Word',
    style: 'bg-sky-100/90 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300',
  },
  epub: {
    label: 'EPUB',
    style: 'bg-emerald-100/90 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300',
  },
};

export function LibraryView({
  books,
  subjects,
  animateMascot,
  quickUploadSignal,
  onImportBook,
  onUpdateBookMeta,
  onDeleteBook,
  onOpenBook,
}: LibraryViewProps) {
  const [shelf, setShelf] = useState<BookShelf>('law');
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');
  const [formatFilter, setFormatFilter] = useState<BookFormat | 'ALL'>('ALL');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Upload / Indexing modal
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadAuthor, setUploadAuthor] = useState('');
  const [uploadShelf, setUploadShelf] = useState<BookShelf>('law');
  const [uploadSubjectId, setUploadSubjectId] = useState('');
  const [uploadColor, setUploadColor] = useState<SubjectColorId>('lavender');
  const [indexingState, setIndexingState] = useState<{
    active: boolean;
    percent: number;
    label: string;
    error?: string;
  }>({ active: false, percent: 0, label: '' });

  // Edit book metadata modal
  const [editingBook, setEditingBook] = useState<BookItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [editShelf, setEditShelf] = useState<BookShelf>('law');
  const [editSubjectId, setEditSubjectId] = useState('');
  const [editColor, setEditColor] = useState<SubjectColorId>('lavender');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastSignalSeq = useRef(quickUploadSignal?.seq ?? 0);

  const activeSubjects = useMemo(() => subjects.filter((s) => !s.archived), [subjects]);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);

  useEffect(() => {
    if (quickUploadSignal && quickUploadSignal.seq > lastSignalSeq.current) {
      lastSignalSeq.current = quickUploadSignal.seq;
      const targetShelf = quickUploadSignal.shelf ?? 'law';
      setShelf(targetShelf);
      openUploadDialog(null, targetShelf, quickUploadSignal.subjectId ?? '');
    }
  }, [quickUploadSignal]);

  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [openMenuId]);

  function openUploadDialog(
    file: File | null = null,
    targetShelf: BookShelf = shelf,
    targetSubjectId = subjectFilter !== 'ALL' ? subjectFilter : ''
  ) {
    setSelectedFile(file);
    setUploadTitle(
      file ? file.name.replace(/\.(pdf|docx|epub)$/i, '').replace(/[_-]+/g, ' ').trim() : ''
    );
    setUploadAuthor('');
    setUploadShelf(targetShelf);
    setUploadSubjectId(targetShelf === 'law' ? targetSubjectId : '');
    setUploadColor(targetShelf === 'personal' ? 'blush' : 'lavender');
    setIndexingState({ active: false, percent: 0, label: '' });
    setUploadModalOpen(true);
  }

  function handleFilePicked(file: File | undefined) {
    if (!file) return;
    const fmt = detectBookFormat(file.name);
    if (!fmt) {
      setIndexingState({
        active: false,
        percent: 0,
        label: '',
        error: 'Formato no soportado. Elige un archivo PDF, Word (.docx) o EPUB.',
      });
      return;
    }
    setSelectedFile(file);
    setIndexingState({ active: false, percent: 0, label: '' });
    if (!uploadTitle.trim()) {
      setUploadTitle(file.name.replace(/\.(pdf|docx|epub)$/i, '').replace(/[_-]+/g, ' ').trim());
    }
  }

  async function handleConfirmImport(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) return;

    const bookId = createId('book');
    setIndexingState({ active: true, percent: 5, label: 'Iniciando lectura...' });

    try {
      const parsed = await parseAndIndexDocument(selectedFile, bookId, (percent, label) => {
        setIndexingState({ active: true, percent, label });
      });

      const now = Date.now();
      const newBook: BookItem = {
        id: bookId,
        title: uploadTitle.trim() || parsed.suggestedTitle,
        author: uploadAuthor.trim() || parsed.suggestedAuthor,
        shelf: uploadShelf,
        format: parsed.format,
        subjectId: uploadShelf === 'law' && uploadSubjectId ? uploadSubjectId : undefined,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        totalLocations: Math.max(1, parsed.totalLocations),
        currentLocation: 1,
        readingNotes: '',
        coverColor: uploadColor,
        coverDataUrl: parsed.coverDataUrl,
        isFavorite: false,
        indexed: true,
        createdAt: now,
        updatedAt: now,
      };

      await onImportBook(newBook, parsed);
      setShelf(uploadShelf);
      setUploadModalOpen(false);
      setSelectedFile(null);
      setIndexingState({ active: false, percent: 0, label: '' });
    } catch (err) {
      setIndexingState({
        active: false,
        percent: 0,
        label: '',
        error: err instanceof Error ? err.message : 'No se pudo importar este archivo.',
      });
    }
  }

  function openEditModal(book: BookItem) {
    setOpenMenuId(null);
    setEditingBook(book);
    setEditTitle(book.title);
    setEditAuthor(book.author);
    setEditShelf(book.shelf);
    setEditSubjectId(book.subjectId ?? '');
    setEditColor(book.coverColor);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingBook || !editTitle.trim()) return;
    await onUpdateBookMeta(editingBook.id, {
      title: editTitle.trim(),
      author: editAuthor.trim(),
      shelf: editShelf,
      subjectId: editShelf === 'law' && editSubjectId ? editSubjectId : undefined,
      coverColor: editColor,
    });
    setEditingBook(null);
  }

  const lawCount = books.filter((b) => b.shelf === 'law').length;
  const personalCount = books.filter((b) => b.shelf === 'personal').length;

  const filteredBooks = useMemo(() => {
    const q = normalizeText(searchQuery);
    return books
      .filter((b) => {
        if (b.shelf !== shelf) return false;
        if (onlyFavorites && !b.isFavorite) return false;
        if (formatFilter !== 'ALL' && b.format !== formatFilter) return false;
        if (shelf === 'law' && subjectFilter !== 'ALL' && b.subjectId !== subjectFilter) {
          return false;
        }
        if (!q) return true;
        return (
          normalizeText(b.title).includes(q) ||
          normalizeText(b.author).includes(q) ||
          normalizeText(b.fileName).includes(q)
        );
      })
      .sort((a, b) => (b.lastOpenedAt ?? b.createdAt) - (a.lastOpenedAt ?? a.createdAt));
  }, [books, shelf, onlyFavorites, formatFilter, subjectFilter, searchQuery]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      openUploadDialog(file, shelf);
    }
  }

  return (
    <div
      className="space-y-6 pb-10"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setIsDragging(false);
      }}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <ColdiAvatar pose="reading" size="md" floating={animateMascot} />
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-[#2E1F3E] dark:text-white">
            Biblioteca
          </h1>
        </div>

        <button
          onClick={() => openUploadDialog(null, shelf)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-accent hover:bg-accent-dark text-white text-sm font-semibold shadow-soft transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Agregar libro</span>
        </button>
      </div>

      {/* Dual Shelf Switcher + Filter Controls */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="inline-flex p-1 rounded-2xl bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700 self-start">
          <button
            onClick={() => {
              setShelf('law');
              setSubjectFilter('ALL');
            }}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              shelf === 'law'
                ? 'bg-accent text-white shadow-sm'
                : 'text-[#6C5788] dark:text-[#B9A7D1] hover:text-accent'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Derecho ({lawCount})</span>
          </button>
          <button
            onClick={() => {
              setShelf('personal');
              setSubjectFilter('ALL');
            }}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              shelf === 'personal'
                ? 'bg-blush-500 text-white shadow-sm'
                : 'text-[#6C5788] dark:text-[#B9A7D1] hover:text-blush-500'
            }`}
          >
            <Heart className="w-3.5 h-3.5" />
            <span>Lectura Personal ({personalCount})</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:min-w-[200px]">
            <Search className="w-4 h-4 text-[#9B89B3] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrar por título o autor..."
              className="w-full pl-9 pr-4 py-2 rounded-2xl bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700 text-xs text-[#2E1F3E] dark:text-white placeholder:text-[#9D8AB5] focus:outline-none focus:ring-2 focus:ring-lavender-400/50"
            />
          </div>

          {shelf === 'law' && activeSubjects.length > 0 && (
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="px-3 py-2 rounded-2xl bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700 text-xs font-semibold text-[#4A3861] dark:text-[#E2D8F3] focus:outline-none"
            >
              <option value="ALL">Todas las materias</option>
              {activeSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}

          <select
            value={formatFilter}
            onChange={(e) => setFormatFilter(e.target.value as BookFormat | 'ALL')}
            className="px-3 py-2 rounded-2xl bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700 text-xs font-semibold text-[#4A3861] dark:text-[#E2D8F3] focus:outline-none"
          >
            <option value="ALL">PDF / Word / EPUB</option>
            <option value="pdf">Solo PDF</option>
            <option value="docx">Solo Word</option>
            <option value="epub">Solo EPUB</option>
          </select>

          <button
            onClick={() => setOnlyFavorites((v) => !v)}
            className={`p-2 rounded-2xl border transition-colors ${
              onlyFavorites
                ? 'bg-amber-100 dark:bg-amber-900/35 border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-300'
                : 'bg-white dark:bg-midnight-900 border-lavender-200/80 dark:border-midnight-700 text-[#9B89B3]'
            }`}
            title="Solo favoritos"
          >
            <Star className={`w-4 h-4 ${onlyFavorites ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>

      {/* Drag & Drop highlight banner */}
      {isDragging && (
        <div className="rounded-3xl p-8 text-center border-2 border-dashed border-accent bg-lavender-100/80 dark:bg-midnight-800/80 text-accent dark:text-lavender-300 font-display font-bold">
          Suelta aquí tu PDF, Word (.docx) o EPUB para agregarlo a {shelf === 'law' ? 'Derecho' : 'Lectura Personal'}
        </div>
      )}

      {/* Bookshelf Grid */}
      {filteredBooks.length === 0 ? (
        <div className="rounded-3xl p-10 text-center bg-white dark:bg-midnight-900 border border-dashed border-lavender-300 dark:border-midnight-700 space-y-3">
          <div className="flex justify-center">
            <ColdiAvatar
              pose={shelf === 'personal' ? 'music' : 'reading'}
              size="lg"
              floating={animateMascot}
            />
          </div>
          <h3 className="font-display font-bold text-lg text-[#2E1F3E] dark:text-white">
            {searchQuery || subjectFilter !== 'ALL' || formatFilter !== 'ALL' || onlyFavorites
              ? 'No hay libros con esos filtros'
              : shelf === 'law'
              ? 'Tu estantería de Derecho está lista'
              : 'Tu rincón de Lectura Personal está esperando'}
          </h3>
          <p className="text-sm text-[#735F8C] dark:text-[#A996C3] max-w-md mx-auto">
            {shelf === 'law'
              ? 'Arrastra o sube tus PDFs, documentos de Word o EPUBs para leerlos y buscar temas fácilmente.'
              : 'Guarda aquí tus novelas, libros favoritos o lecturas personales en PDF, Word o EPUB.'}
          </p>
          <button
            onClick={() => openUploadDialog(null, shelf)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-accent hover:bg-accent-dark text-white text-sm font-semibold shadow-soft"
          >
            <Upload className="w-4 h-4" />
            <span>Subir primer archivo</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredBooks.map((book) => {
            const palette = SUBJECT_COLORS[book.coverColor] ?? SUBJECT_COLORS.lavender;
            const subj = book.subjectId ? subjectMap.get(book.subjectId) : undefined;
            const badge = FORMAT_BADGE[book.format];
            const progress = Math.round(
              ((book.currentLocation || 1) / Math.max(1, book.totalLocations || 1)) * 100
            );
            const isMenuOpen = openMenuId === book.id;

            return (
              <div
                key={book.id}
                onClick={() => onOpenBook(book.id)}
                className="group cursor-pointer rounded-3xl bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700/80 shadow-soft hover:-translate-y-0.5 hover:border-accent/50 transition-all flex flex-col overflow-hidden"
              >
                {/* Cover Thumbnail or Pastel Spine */}
                <div
                  className={`relative h-40 flex items-center justify-center overflow-hidden border-b border-lavender-100 dark:border-midnight-800 ${palette.cardBg}`}
                >
                  {book.coverDataUrl ? (
                    <img
                      src={book.coverDataUrl}
                      alt={book.title}
                      className="h-full w-auto max-w-full object-contain py-2 drop-shadow-sm group-hover:scale-[1.03] transition-transform"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 px-5 text-center">
                      <div className={`p-3 rounded-2xl ${palette.badgeBg} ${palette.badgeText}`}>
                        {book.format === 'docx' ? (
                          <FileText className="w-7 h-7" />
                        ) : (
                          <BookOpen className="w-7 h-7" />
                        )}
                      </div>
                      <span className={`text-[11px] font-bold uppercase tracking-wider ${palette.badgeText}`}>
                        {badge.label}
                      </span>
                    </div>
                  )}

                  {/* Format pill top-left */}
                  <span
                    className={`absolute top-2.5 left-2.5 text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm ${badge.style}`}
                  >
                    {badge.label}
                  </span>

                  {/* Favorite & Menu top-right */}
                  <div className="absolute top-2 right-2 flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateBookMeta(book.id, { isFavorite: !book.isFavorite });
                      }}
                      className={`p-1.5 rounded-xl bg-white/85 dark:bg-midnight-900/80 backdrop-blur-sm transition-colors ${
                        book.isFavorite
                          ? 'text-amber-500'
                          : 'text-[#9B89B3] hover:text-amber-500'
                      }`}
                      title={book.isFavorite ? 'Quitar favorito' : 'Marcar favorito'}
                    >
                      <Star className={`w-3.5 h-3.5 ${book.isFavorite ? 'fill-current' : ''}`} />
                    </button>

                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(isMenuOpen ? null : book.id);
                        }}
                        className="p-1.5 rounded-xl bg-white/85 dark:bg-midnight-900/80 backdrop-blur-sm text-[#7E6B96] hover:text-accent"
                        aria-label={`Opciones de ${book.title}`}
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>

                      {isMenuOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 mt-1 w-48 rounded-2xl bg-white dark:bg-midnight-900 border border-lavender-200 dark:border-midnight-700 shadow-soft-lg py-1.5 z-30"
                        >
                          <button
                            onClick={() => openEditModal(book)}
                            className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#3F2D57] dark:text-[#E8DEF6] hover:bg-lavender-50 dark:hover:bg-midnight-800"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-accent dark:text-lavender-300" />
                            <span>Editar datos</span>
                          </button>
                          <button
                            onClick={() => {
                              setOpenMenuId(null);
                              onUpdateBookMeta(book.id, {
                                shelf: book.shelf === 'law' ? 'personal' : 'law',
                                subjectId: book.shelf === 'law' ? undefined : book.subjectId,
                              });
                            }}
                            className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#3F2D57] dark:text-[#E8DEF6] hover:bg-lavender-50 dark:hover:bg-midnight-800"
                          >
                            <BookOpen className="w-3.5 h-3.5 text-sky-500" />
                            <span>
                              Mover a {book.shelf === 'law' ? 'Personal' : 'Derecho'}
                            </span>
                          </button>
                          <div className="my-1 border-t border-lavender-100 dark:border-midnight-800" />
                          <button
                            onClick={() => {
                              setOpenMenuId(null);
                              onDeleteBook(book.id);
                            }}
                            className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Eliminar libro</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Book Metadata & Progress */}
                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div className="space-y-1">
                    {subj && (
                      <span
                        className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          SUBJECT_COLORS[subj.color].badgeBg
                        } ${SUBJECT_COLORS[subj.color].badgeText}`}
                      >
                        {subj.name}
                      </span>
                    )}
                    <h3 className="font-display font-bold text-sm text-[#2E1F3E] dark:text-white line-clamp-2 leading-snug">
                      {book.title}
                    </h3>
                    {book.author && (
                      <p className="text-xs text-[#7A6693] dark:text-[#A995C4] truncate">
                        {book.author}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-[#7A6693] dark:text-[#A995C4]">
                      <span>
                        {book.format === 'pdf' ? 'Pág.' : 'Sec.'} {book.currentLocation}/{book.totalLocations}
                      </span>
                      <span className="font-semibold">{progress}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-lavender-100 dark:bg-midnight-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent transition-all"
                        style={{ width: `${Math.max(4, progress)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload & Index Book Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1D112C]/55 backdrop-blur-sm">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-midnight-900 border border-lavender-200 dark:border-midnight-700 shadow-soft-lg p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ColdiAvatar pose="reading" size="xs" />
                <h2 className="font-display font-bold text-xl text-[#2E1F3E] dark:text-white">
                  Agregar a tu biblioteca
                </h2>
              </div>
              {!indexingState.active && (
                <button
                  onClick={() => setUploadModalOpen(false)}
                  className="p-2 rounded-xl text-[#7E6B96] hover:bg-lavender-100 dark:hover:bg-midnight-800"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <form onSubmit={handleConfirmImport} className="space-y-4">
              {/* File picker box */}
              <div
                onClick={() => !indexingState.active && fileInputRef.current?.click()}
                className="cursor-pointer rounded-2xl p-5 text-center border-2 border-dashed border-lavender-300 dark:border-midnight-700 bg-lavender-50/70 dark:bg-midnight-850 hover:border-accent transition-colors space-y-1.5"
              >
                <Upload className="w-6 h-6 text-accent dark:text-lavender-300 mx-auto" />
                {selectedFile ? (
                  <>
                    <p className="text-sm font-bold text-[#2E1F3E] dark:text-white truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-[#7A6693] dark:text-[#A995C4]">
                      {formatFileSize(selectedFile.size)} · Toca para cambiar archivo
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-bold text-[#2E1F3E] dark:text-white">
                      Elige un archivo PDF, Word (.docx) o EPUB
                    </p>
                    <p className="text-xs text-[#7A6693] dark:text-[#A995C4]">
                      Listo para leer, subrayar y buscar al instante
                    </p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.epub,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/epub+zip"
                  onChange={(e) => handleFilePicked(e.target.files?.[0])}
                  className="hidden"
                />
              </div>

              {/* Shelf Toggle */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700">
                <button
                  type="button"
                  disabled={indexingState.active}
                  onClick={() => setUploadShelf('law')}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    uploadShelf === 'law'
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-[#6D588A] dark:text-[#B9A7D1]'
                  }`}
                >
                  Derecho / Facultad
                </button>
                <button
                  type="button"
                  disabled={indexingState.active}
                  onClick={() => setUploadShelf('personal')}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    uploadShelf === 'personal'
                      ? 'bg-blush-500 text-white shadow-sm'
                      : 'text-[#6D588A] dark:text-[#B9A7D1]'
                  }`}
                >
                  Lectura Personal
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#6D588A] dark:text-[#BAA8D1] mb-1.5">
                  Título
                </label>
                <input
                  type="text"
                  disabled={indexingState.active}
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Se llena automático con el archivo"
                  className="w-full px-4 py-2.5 rounded-2xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 text-sm text-[#2E1F3E] dark:text-white focus:outline-none focus:ring-2 focus:ring-lavender-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#6D588A] dark:text-[#BAA8D1] mb-1.5">
                    Autor (opcional)
                  </label>
                  <input
                    type="text"
                    disabled={indexingState.active}
                    value={uploadAuthor}
                    onChange={(e) => setUploadAuthor(e.target.value)}
                    placeholder="Ej. Ignacio Burgoa"
                    className="w-full px-4 py-2.5 rounded-2xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 text-sm text-[#2E1F3E] dark:text-white focus:outline-none focus:ring-2 focus:ring-lavender-400"
                  />
                </div>

                {uploadShelf === 'law' && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#6D588A] dark:text-[#BAA8D1] mb-1.5">
                      Materia (opcional)
                    </label>
                    <select
                      disabled={indexingState.active}
                      value={uploadSubjectId}
                      onChange={(e) => setUploadSubjectId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 text-sm text-[#2E1F3E] dark:text-white focus:outline-none"
                    >
                      <option value="">General de Derecho</option>
                      {activeSubjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Pastel Spine Color */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#6D588A] dark:text-[#BAA8D1] mb-2">
                  Color de portada
                </label>
                <div className="flex flex-wrap gap-2">
                  {SUBJECT_COLOR_LIST.map((swatch) => {
                    const active = uploadColor === swatch.id;
                    return (
                      <button
                        key={swatch.id}
                        type="button"
                        disabled={indexingState.active}
                        onClick={() => setUploadColor(swatch.id)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform ${
                          active ? 'scale-110 ring-2 ring-offset-2 ring-accent dark:ring-offset-midnight-900' : ''
                        }`}
                        style={{ backgroundColor: swatch.swatch }}
                        title={swatch.label}
                      >
                        {active && <Check className="w-3.5 h-3.5 text-[#2E1F3E]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Indexing Progress Bar */}
              {indexingState.active && (
                <div className="rounded-2xl p-3.5 bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-accent dark:text-lavender-300">
                    <span>{indexingState.label}</span>
                    <span>{indexingState.percent}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-lavender-200/70 dark:bg-midnight-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-200"
                      style={{ width: `${indexingState.percent}%` }}
                    />
                  </div>
                </div>
              )}

              {indexingState.error && (
                <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                  {indexingState.error}
                </p>
              )}

              <div className="flex justify-end gap-2.5 pt-2 border-t border-lavender-100 dark:border-midnight-800">
                <button
                  type="button"
                  disabled={indexingState.active}
                  onClick={() => setUploadModalOpen(false)}
                  className="px-4 py-2.5 rounded-2xl text-sm font-semibold text-[#6E5B85] dark:text-[#BBA9D3] hover:bg-lavender-100 dark:hover:bg-midnight-800 disabled:opacity-40"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!selectedFile || indexingState.active}
                  className="px-5 py-2.5 rounded-2xl bg-accent hover:bg-accent-dark disabled:opacity-45 text-white text-sm font-semibold shadow-soft transition-colors"
                >
                  {indexingState.active ? 'Indexando...' : 'Guardar en biblioteca'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Book Metadata Modal */}
      {editingBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1D112C]/55 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-midnight-900 border border-lavender-200 dark:border-midnight-700 shadow-soft-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-lg text-[#2E1F3E] dark:text-white">
                Editar libro
              </h2>
              <button
                onClick={() => setEditingBook(null)}
                className="p-2 rounded-xl text-[#7E6B96] hover:bg-lavender-100 dark:hover:bg-midnight-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#6D588A] dark:text-[#BAA8D1] mb-1">
                  Título *
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-2xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 text-sm text-[#2E1F3E] dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#6D588A] dark:text-[#BAA8D1] mb-1">
                  Autor
                </label>
                <input
                  type="text"
                  value={editAuthor}
                  onChange={(e) => setEditAuthor(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-2xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 text-sm text-[#2E1F3E] dark:text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditShelf('law')}
                  className={`py-2 rounded-xl text-xs font-bold border ${
                    editShelf === 'law'
                      ? 'bg-accent text-white border-accent'
                      : 'bg-lavender-50 dark:bg-midnight-850 border-lavender-200 dark:border-midnight-700 text-[#6D588A] dark:text-[#B9A7D1]'
                  }`}
                >
                  Derecho
                </button>
                <button
                  type="button"
                  onClick={() => setEditShelf('personal')}
                  className={`py-2 rounded-xl text-xs font-bold border ${
                    editShelf === 'personal'
                      ? 'bg-blush-500 text-white border-blush-500'
                      : 'bg-lavender-50 dark:bg-midnight-850 border-lavender-200 dark:border-midnight-700 text-[#6D588A] dark:text-[#B9A7D1]'
                  }`}
                >
                  Lectura Personal
                </button>
              </div>

              {editShelf === 'law' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#6D588A] dark:text-[#BAA8D1] mb-1">
                    Materia
                  </label>
                  <select
                    value={editSubjectId}
                    onChange={(e) => setEditSubjectId(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-2xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 text-sm text-[#2E1F3E] dark:text-white focus:outline-none"
                  >
                    <option value="">General de Derecho</option>
                    {activeSubjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                {SUBJECT_COLOR_LIST.map((swatch) => {
                  const active = editColor === swatch.id;
                  return (
                    <button
                      key={swatch.id}
                      type="button"
                      onClick={() => setEditColor(swatch.id)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center ${
                        active ? 'ring-2 ring-offset-2 ring-accent dark:ring-offset-midnight-900' : ''
                      }`}
                      style={{ backgroundColor: swatch.swatch }}
                    >
                      {active && <Check className="w-3.5 h-3.5 text-[#2E1F3E]" />}
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingBook(null)}
                  className="px-4 py-2 rounded-2xl text-xs font-semibold text-[#6E5B85] dark:text-[#BBA9D3]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-2xl bg-accent hover:bg-accent-dark text-white text-xs font-semibold"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
