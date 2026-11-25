import { useRef, useState } from 'react';
import {
  BellRing,
  Check,
  ChevronDown,
  ChevronRight,
  Cloud,
  Download,
  GraduationCap,
  LogOut,
  Moon,
  Palette,
  RefreshCw,
  Sliders,
  Sun,
  Upload,
} from 'lucide-react';
import { BRAND_CONFIG } from '../config/brand';
import { ACCENT_THEMES } from '../data/subjectStyles';
import { exportLocalBackup, importLocalBackup } from '../db/database';
import {
  getGoogleDriveConfig,
  saveGoogleDriveConfig,
  type CloudSyncState,
} from '../services/googleDriveSync';
import type { AccentTheme, AppSettings } from '../types/models';
import { ColdiAvatar } from './ColdiAvatar';

interface SettingsViewProps {
  settings: AppSettings;
  cloudSync: CloudSyncState;
  onUpdateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  onConnectCloud: () => Promise<void>;
  onSyncCloudNow: () => Promise<void>;
  onDisconnectCloud: () => void;
  onRefreshCloudConfig: () => void;
}

interface ToggleRowProps {
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}

function ToggleRow({ title, description, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#2E1F3E] dark:text-white">{title}</p>
        <p className="text-xs text-[#735F8C] dark:text-[#A996C3] mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus:outline-none ${
          checked ? 'bg-accent' : 'bg-lavender-200 dark:bg-midnight-700'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 mt-0.5 ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

export function SettingsView({
  settings,
  cloudSync,
  onUpdateSettings,
  onConnectCloud,
  onSyncCloudNow,
  onDisconnectCloud,
  onRefreshCloudConfig,
}: SettingsViewProps) {
  const [semesterLabel, setSemesterLabel] = useState(settings.currentSemesterLabel);
  const [dailyGoal, setDailyGoal] = useState(settings.dailyGoalMinutes);
  const [savedNotice, setSavedNotice] = useState(false);
  const [backupFeedback, setBackupFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );
  const initialDriveCfg = getGoogleDriveConfig();
  const [driveConfigOpen, setDriveConfigOpen] = useState(false);
  const [driveClientId, setDriveClientId] = useState(initialDriveCfg.clientId);
  const [driveClientSecret, setDriveClientSecret] = useState(initialDriveCfg.clientSecret ?? '');
  const [driveCfgSaved, setDriveCfgSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleSaveStudyPrefs(e: React.FormEvent) {
    e.preventDefault();
    await onUpdateSettings({
      currentSemesterLabel: semesterLabel.trim() || 'Semestre Actual',
      dailyGoalMinutes: Math.max(15, Math.min(480, Number(dailyGoal) || 60)),
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  }

  async function handleExport() {
    try {
      const json = await exportLocalBackup();
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `respaldo-${BRAND_CONFIG.appName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${dateStr}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupFeedback({ type: 'ok', text: 'Respaldo descargado correctamente en formato JSON.' });
    } catch {
      setBackupFeedback({ type: 'err', text: 'No se pudo generar el archivo de respaldo.' });
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const result = await importLocalBackup(text);
      setBackupFeedback({
        type: 'ok',
        text: `Respaldo importado (${result.subjects} materias y ${result.events} eventos de agenda).`,
      });
    } catch (err) {
      setBackupFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Archivo de respaldo inválido.',
      });
    } finally {
      e.target.value = '';
    }
  }

  return (
    <div className="max-w-3xl space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center gap-4">
        <ColdiAvatar pose="music" size="md" floating={settings.mascotAnimations} />
        <h1 className="font-display font-bold text-2xl sm:text-3xl text-[#2E1F3E] dark:text-white">
          Ajustes
        </h1>
      </div>

      {/* Appearance & Pastel Palette Card */}
      <div className="rounded-3xl p-6 bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700 shadow-soft space-y-5">
        <div className="flex items-center gap-2.5">
          <Palette className="w-5 h-5 text-accent dark:text-lavender-300" />
          <h2 className="font-display font-bold text-lg text-[#2E1F3E] dark:text-white">
            Apariencia y Colores
          </h2>
        </div>

        {/* Light / Dark Mode */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onUpdateSettings({ colorMode: 'light' })}
            className={`flex items-center gap-3 p-4 rounded-2xl border text-left transition-all ${
              settings.colorMode === 'light'
                ? 'border-accent bg-lavender-50 dark:bg-midnight-800 ring-2 ring-lavender-300/60'
                : 'border-lavender-200 dark:border-midnight-700 hover:bg-lavender-50/50 dark:hover:bg-midnight-850'
            }`}
          >
            <span className="p-2.5 rounded-xl bg-amber-100 text-amber-600">
              <Sun className="w-5 h-5" />
            </span>
            <div>
              <p className="font-display font-bold text-sm text-[#2E1F3E] dark:text-white">
                Lavanda Pastel
              </p>
              <p className="text-xs text-[#735F8C] dark:text-[#A996C3]">Claro, luminoso y cálido</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onUpdateSettings({ colorMode: 'dark' })}
            className={`flex items-center gap-3 p-4 rounded-2xl border text-left transition-all ${
              settings.colorMode === 'dark'
                ? 'border-accent bg-lavender-50 dark:bg-midnight-800 ring-2 ring-lavender-400/50'
                : 'border-lavender-200 dark:border-midnight-700 hover:bg-lavender-50/50 dark:hover:bg-midnight-850'
            }`}
          >
            <span className="p-2.5 rounded-xl bg-indigo-950 text-lavender-300">
              <Moon className="w-5 h-5" />
            </span>
            <div>
              <p className="font-display font-bold text-sm text-[#2E1F3E] dark:text-white">
                Midnight Lavender
              </p>
              <p className="text-xs text-[#735F8C] dark:text-[#A996C3]">Suave para estudiar de noche</p>
            </div>
          </button>
        </div>

        {/* Accent Palettes */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#6D588A] dark:text-[#BAA8D1] mb-2.5">
            Color de acento
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ACCENT_THEMES.map((theme) => {
              const active = settings.accentTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => onUpdateSettings({ accentTheme: theme.id as AccentTheme })}
                  className={`flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all ${
                    active
                      ? 'border-accent bg-lavender-50 dark:bg-midnight-800 shadow-sm'
                      : 'border-lavender-200/80 dark:border-midnight-700 hover:border-lavender-300'
                  }`}
                >
                  <span
                    className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white shadow-sm"
                    style={{ backgroundColor: theme.preview }}
                  >
                    {active && <Check className="w-4 h-4" />}
                  </span>
                  <div className="min-w-0">
                    <p className="font-display font-bold text-sm text-[#2E1F3E] dark:text-white">
                      {theme.label}
                    </p>
                    <p className="text-xs text-[#735F8C] dark:text-[#A996C3] truncate">
                      {theme.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Exam Reminders & Calendar Behavior */}
      <div className="rounded-3xl p-6 bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700 shadow-soft space-y-4">
        <div className="flex items-center gap-2.5">
          <BellRing className="w-5 h-5 text-accent dark:text-lavender-300" />
          <h2 className="font-display font-bold text-lg text-[#2E1F3E] dark:text-white">
            Recordatorios de Exámenes
          </h2>
        </div>

        <ToggleRow
          title="Acceso directo automático 24 h antes de un examen"
          description="Al abrir la app dentro de las 24 horas previas al examen (hasta su hora exacta), muestra el acceso rápido directo a esa materia."
          checked={settings.examUrgentShortcut}
          onChange={(next) => onUpdateSettings({ examUrgentShortcut: next })}
        />

        <div className="pt-3 border-t border-lavender-100 dark:border-midnight-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#2E1F3E] dark:text-white">
              Avisar con anticipación antes del examen
            </p>
            <p className="text-xs text-[#735F8C] dark:text-[#A996C3]">
              Muestra un recordatorio suave en Inicio días antes de la fecha del examen.
            </p>
          </div>
          <div className="inline-flex p-1 rounded-xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 shrink-0 self-start sm:self-auto">
            {[2, 3, 5].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => onUpdateSettings({ examReminderDays: days })}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  settings.examReminderDays === days
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-[#6D588A] dark:text-[#B9A7D1]'
                }`}
              >
                {days} días
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Semester & Study Preferences */}
      <form
        onSubmit={handleSaveStudyPrefs}
        className="rounded-3xl p-6 bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700 shadow-soft space-y-4"
      >
        <div className="flex items-center gap-2.5">
          <GraduationCap className="w-5 h-5 text-accent dark:text-lavender-300" />
          <h2 className="font-display font-bold text-lg text-[#2E1F3E] dark:text-white">
            Semestre y Estudio
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#6D588A] dark:text-[#BAA8D1] mb-1.5">
              Semestre en curso
            </label>
            <input
              type="text"
              value={semesterLabel}
              onChange={(e) => setSemesterLabel(e.target.value)}
              placeholder="Ej. 6.º Semestre · 2026"
              className="w-full px-4 py-2.5 rounded-2xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 text-sm text-[#2E1F3E] dark:text-white focus:outline-none focus:ring-2 focus:ring-lavender-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#6D588A] dark:text-[#BAA8D1] mb-1.5">
              Meta diaria de estudio (minutos)
            </label>
            <input
              type="number"
              min={15}
              max={480}
              step={15}
              value={dailyGoal}
              onChange={(e) => setDailyGoal(Number(e.target.value))}
              className="w-full px-4 py-2.5 rounded-2xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 text-sm text-[#2E1F3E] dark:text-white focus:outline-none focus:ring-2 focus:ring-lavender-400"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-1">
          {savedNotice && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <Check className="w-4 h-4" />
              ¡Guardado!
            </span>
          )}
          <button
            type="submit"
            className="px-4 py-2 rounded-2xl bg-accent hover:bg-accent-dark text-white text-xs font-semibold shadow-soft transition-colors"
          >
            Guardar cambios
          </button>
        </div>
      </form>

      {/* Feature Toggles Card */}
      <div className="rounded-3xl p-6 bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700 shadow-soft space-y-3">
        <div className="flex items-center gap-2.5 mb-2">
          <Sliders className="w-5 h-5 text-accent dark:text-lavender-300" />
          <h2 className="font-display font-bold text-lg text-[#2E1F3E] dark:text-white">
            Funciones y Comportamiento
          </h2>
        </div>

        <div className="divide-y divide-lavender-100 dark:divide-midnight-800">
          <ToggleRow
            title="Mostrar «Término jurídico del día» en Inicio"
            description="Muestra cada día un concepto o locución latina para repasar."
            checked={settings.showDailyTerm}
            onChange={(next) => onUpdateSettings({ showDailyTerm: next })}
          />
          <ToggleRow
            title="Subrayar términos del glosario en los libros"
            description="Marca automáticamente las palabras del glosario dentro de PDFs, Word y EPUB para ver su definición al pasar el cursor."
            checked={settings.glossaryUnderlinesDefault}
            onChange={(next) => onUpdateSettings({ glossaryUnderlinesDefault: next })}
          />
          <ToggleRow
            title="Sugerencias de libros al escribir apuntes"
            description="Busca coincidencias en tus libros cerca de donde estás escribiendo para abrir la página al lado con un clic."
            checked={settings.liveBookSuggestions}
            onChange={(next) => onUpdateSettings({ liveBookSuggestions: next })}
          />
          <ToggleRow
            title="Campanita suave al terminar un Pomodoro"
            description="Reproduce un aviso tranquilo cuando concluye tu bloque de enfoque o descanso."
            checked={settings.pomodoroChime}
            onChange={(next) => onUpdateSettings({ pomodoroChime: next })}
          />
          <ToggleRow
            title="Animaciones suaves de Coldi"
            description="Movimiento ligero de flotación en las ilustraciones del pingüinito."
            checked={settings.mascotAnimations}
            onChange={(next) => onUpdateSettings({ mascotAnimations: next })}
          />
          <ToggleRow
            title="Confirmación estricta al eliminar materias"
            description="Exige escribir el nombre exacto de la materia antes de borrarla definitivamente."
            checked={settings.strictDeleteConfirm}
            onChange={(next) => onUpdateSettings({ strictDeleteConfirm: next })}
          />
        </div>
      </div>

      {/* Offline Backup & Phase 4 Google Drive Sync */}
      <div className="rounded-3xl p-6 bg-white dark:bg-midnight-900 border border-lavender-200/80 dark:border-midnight-700 shadow-soft space-y-4">
        <div className="flex items-center gap-2.5">
          <Cloud className="w-5 h-5 text-accent dark:text-lavender-300" />
          <h2 className="font-display font-bold text-lg text-[#2E1F3E] dark:text-white">
            Respaldo Local y Google Drive
          </h2>
        </div>

        <p className="text-xs sm:text-sm text-[#6E5B85] dark:text-[#B9A7D1] leading-relaxed">
          Tus datos se guardan automáticamente en este dispositivo. Puedes exportar o importar una copia de seguridad cuando quieras.
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-lavender-100 dark:bg-midnight-800 hover:bg-lavender-200/80 text-accent dark:text-lavender-300 text-xs font-bold transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Exportar respaldo (.json)</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 hover:border-accent text-[#4A3861] dark:text-[#D5C9E6] text-xs font-bold transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>Importar respaldo</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>

        {backupFeedback && (
          <div
            className={`px-4 py-2.5 rounded-2xl text-xs font-semibold ${
              backupFeedback.type === 'ok'
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
            }`}
          >
            {backupFeedback.text}
          </div>
        )}

        {/* Live Google Drive Seamless Sync */}
        <div className="pt-4 border-t border-lavender-100 dark:border-midnight-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display font-bold text-sm text-[#2E1F3E] dark:text-white flex items-center gap-2">
                <span>Google Drive</span>
                {cloudSync.connected && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {cloudSync.syncing ? 'Sincronizando...' : 'Conectado'}
                  </span>
                )}
              </h3>
              <p className="text-xs text-[#735F8C] dark:text-[#A996C3] mt-0.5">
                {cloudSync.connected
                  ? `${cloudSync.email ?? 'Cuenta conectada'} · Carpeta «Coldi's Corner»${
                      cloudSync.lastSyncedAt
                        ? ` · Última sincronización: ${new Intl.DateTimeFormat('es-MX', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          }).format(new Date(cloudSync.lastSyncedAt))}`
                        : ''
                    }`
                  : 'Conecta tu cuenta de Google una sola vez para sincronizar automáticamente tus libros, apuntes, calendario y flashcards entre tu laptop y tu celular.'}
              </p>
            </div>
          </div>

          {cloudSync.error && (
            <div className="px-3.5 py-2 rounded-2xl text-xs font-semibold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
              {cloudSync.error}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2.5">
            {cloudSync.connected ? (
              <>
                <button
                  type="button"
                  disabled={cloudSync.syncing}
                  onClick={onSyncCloudNow}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-accent hover:bg-accent-dark disabled:opacity-50 text-white text-xs font-bold shadow-soft transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${cloudSync.syncing ? 'animate-spin' : ''}`} />
                  <span>{cloudSync.syncing ? 'Sincronizando...' : 'Sincronizar ahora'}</span>
                </button>
                <button
                  type="button"
                  onClick={onDisconnectCloud}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white dark:bg-midnight-850 border border-lavender-200 dark:border-midnight-700 hover:border-rose-300 text-[#6E5B85] hover:text-rose-600 text-xs font-bold transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Desconectar</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={cloudSync.syncing}
                onClick={async () => {
                  if (!cloudSync.hasClientId) {
                    setDriveConfigOpen(true);
                    return;
                  }
                  await onConnectCloud();
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-accent hover:bg-accent-dark disabled:opacity-50 text-white text-xs font-bold shadow-soft transition-colors"
              >
                <Cloud className="w-4 h-4" />
                <span>
                  {cloudSync.syncing ? 'Conectando...' : 'Conectar con Google Drive'}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setDriveConfigOpen((v) => !v)}
              className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-[11px] font-semibold text-[#7E6B96] dark:text-[#A995C4] hover:text-accent"
            >
              {driveConfigOpen ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
              <span>Configuración de conexión</span>
            </button>
          </div>

          {driveConfigOpen && (
            <div className="p-4 rounded-2xl bg-lavender-50 dark:bg-midnight-850 border border-lavender-200/80 dark:border-midnight-700 space-y-3">
              <p className="text-[11px] text-[#6B5487] dark:text-[#BFAED6] leading-relaxed">
                Solo se configura una vez (o viene preconfigurado si se incluye al generar el instalador). Crea un <strong>OAuth Client ID</strong> gratuito en Google Cloud Console y pégalo aquí.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#6D588A] dark:text-[#BAA8D1] mb-1">
                    Google Client ID
                  </label>
                  <input
                    type="text"
                    value={driveClientId}
                    onChange={(e) => setDriveClientId(e.target.value)}
                    placeholder="xxxx.apps.googleusercontent.com"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-midnight-900 border border-lavender-200 dark:border-midnight-700 text-xs text-[#2E1F3E] dark:text-white focus:outline-none focus:ring-2 focus:ring-lavender-400"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#6D588A] dark:text-[#BAA8D1] mb-1">
                    Client Secret (solo app de escritorio)
                  </label>
                  <input
                    type="password"
                    value={driveClientSecret}
                    onChange={(e) => setDriveClientSecret(e.target.value)}
                    placeholder="Opcional"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-midnight-900 border border-lavender-200 dark:border-midnight-700 text-xs text-[#2E1F3E] dark:text-white focus:outline-none focus:ring-2 focus:ring-lavender-400"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                {driveCfgSaved && (
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    ¡Configuración guardada!
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    saveGoogleDriveConfig({
                      clientId: driveClientId,
                      clientSecret: driveClientSecret || undefined,
                    });
                    onRefreshCloudConfig();
                    setDriveCfgSaved(true);
                    setTimeout(() => setDriveCfgSaved(false), 2000);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-accent hover:bg-accent-dark text-white text-xs font-bold"
                >
                  Guardar conexión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
