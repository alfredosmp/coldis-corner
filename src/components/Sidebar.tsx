import { useEffect, useRef } from 'react';
import {
  BookMarked,
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderKanban,
  Home,
  Layers,
  Moon,
  Search,
  Settings,
  Sun,
  Timer,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { ColorMode, NavSection } from '../types/models';
import { ColdiAvatar } from './ColdiAvatar';

interface NavItem {
  id: NavSection;
  label: string;
  shortLabel: string;
  icon: typeof Home;
  mobilePrimary?: boolean;
  groupBreakBefore?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Inicio', shortLabel: 'Inicio', icon: Home, mobilePrimary: true },
  { id: 'subjects', label: 'Materias', shortLabel: 'Materias', icon: FolderKanban, mobilePrimary: true },
  { id: 'library', label: 'Biblioteca', shortLabel: 'Libros', icon: BookOpen },
  { id: 'calendar', label: 'Calendario', shortLabel: 'Agenda', icon: Calendar, mobilePrimary: true },
  { id: 'search', label: 'Buscador', shortLabel: 'Buscar', icon: Search },
  { id: 'glossary', label: 'Glosario', shortLabel: 'Glosario', icon: BookMarked },
  // Study workflow grouped together at the bottom
  { id: 'notes', label: 'Apuntes', shortLabel: 'Apuntes', icon: FileText, mobilePrimary: true, groupBreakBefore: true },
  { id: 'flashcards', label: 'Flashcards', shortLabel: 'Tarjetas', icon: Layers },
  { id: 'pomodoro', label: 'Sesión Pomodoro', shortLabel: 'Pomodoro', icon: Timer },
  { id: 'settings', label: 'Ajustes', shortLabel: 'Ajustes', icon: Settings, mobilePrimary: true, groupBreakBefore: true },
];

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  appName: string;
  colorMode: ColorMode;
  onToggleColorMode: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  hasExamAlert?: boolean;
}

export function Sidebar({
  activeSection,
  onSelectSection,
  appName,
  colorMode,
  onToggleColorMode,
  isMuted,
  onToggleMute,
  collapsed,
  onToggleCollapsed,
  hasExamAlert = false,
}: SidebarProps) {
  const activeMobileBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeMobileBtnRef.current?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }, [activeSection]);

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col shrink-0 h-screen sticky top-0 border-r border-lavender-200/70 dark:border-midnight-700/70 bg-white/80 dark:bg-midnight-900/90 backdrop-blur-md transition-all duration-300 z-30 ${
          collapsed ? 'w-[78px]' : 'w-[244px]'
        }`}
      >
        {/* Clean Brand Header (without 'Estudio Jurídico' subtitle) */}
        <div
          className={`flex items-center gap-3 p-4 border-b border-lavender-100/80 dark:border-midnight-800 ${
            collapsed ? 'justify-center' : 'justify-between'
          }`}
        >
          <button
            onClick={() => onSelectSection('dashboard')}
            className="flex items-center gap-3 text-left group min-w-0"
            title={appName}
          >
            <ColdiAvatar pose="default" size="sm" className="group-hover:scale-105 transition-transform" />
            {!collapsed && (
              <p className="font-display font-bold text-base text-[#2E1F3E] dark:text-[#F5EFFC] truncate leading-tight">
                {appName}
              </p>
            )}
          </button>

          {!collapsed && (
            <button
              onClick={onToggleCollapsed}
              className="p-1.5 rounded-xl text-[#7E6B96] hover:text-accent hover:bg-lavender-100 dark:hover:bg-midnight-800 transition-colors"
              title="Contraer menú"
              aria-label="Contraer menú"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {collapsed && (
          <div className="flex justify-center pt-2">
            <button
              onClick={onToggleCollapsed}
              className="p-1.5 rounded-xl text-[#7E6B96] hover:text-accent hover:bg-lavender-100 dark:hover:bg-midnight-800 transition-colors"
              title="Expandir menú"
              aria-label="Expandir menú"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Navigation Links grouped by workflow */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            const showAlertDot = item.id === 'calendar' && hasExamAlert;
            return (
              <div key={item.id}>
                {item.groupBreakBefore && (
                  <div className="my-2 mx-2 border-t border-lavender-100 dark:border-midnight-800" />
                )}
                <button
                  onClick={() => onSelectSection(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={`relative w-full flex items-center gap-3 rounded-2xl transition-all duration-200 ${
                    collapsed ? 'justify-center px-2 py-2.5' : 'px-3.5 py-2.5'
                  } ${
                    isActive
                      ? 'bg-accent text-white shadow-soft font-semibold'
                      : 'text-[#54406B] dark:text-[#CBBCE0] hover:bg-lavender-100/80 dark:hover:bg-midnight-800/90 font-medium'
                  }`}
                >
                  <Icon
                    className={`w-[18px] h-[18px] shrink-0 ${
                      isActive ? 'text-white' : 'text-accent dark:text-lavender-300'
                    }`}
                  />
                  {!collapsed && (
                    <>
                      <span className="text-sm truncate flex-1 text-left">{item.label}</span>
                      {showAlertDot && (
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isActive ? 'bg-blush-200' : 'bg-blush-500'
                          }`}
                          title="Examen próximo"
                        />
                      )}
                    </>
                  )}
                  {collapsed && showAlertDot && (
                    <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-blush-500" />
                  )}
                </button>
              </div>
            );
          })}
        </nav>

        {/* Minimalist Footer: Theme Toggle + Always-Handy Small Mute Button */}
        <div className="p-3 border-t border-lavender-100/80 dark:border-midnight-800">
          <div className={`flex items-center gap-1.5 ${collapsed ? 'flex-col' : 'justify-between'}`}>
            <button
              onClick={onToggleColorMode}
              className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold text-[#54406B] dark:text-[#CBBCE0] hover:bg-lavender-100 dark:hover:bg-midnight-800 transition-colors ${
                collapsed ? 'justify-center w-full' : 'flex-1'
              }`}
              title={colorMode === 'light' ? 'Modo Nocturno' : 'Modo Lavanda'}
            >
              {colorMode === 'light' ? (
                <Moon className="w-4 h-4 text-accent shrink-0" />
              ) : (
                <Sun className="w-4 h-4 text-amber-300 shrink-0" />
              )}
              {!collapsed && (
                <span className="truncate">{colorMode === 'light' ? 'Nocturno' : 'Claro'}</span>
              )}
            </button>

            <button
              onClick={onToggleMute}
              className={`p-2 rounded-2xl transition-colors shrink-0 ${
                isMuted
                  ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300'
                  : 'text-[#6D588A] dark:text-[#CBBCE0] hover:bg-lavender-100 dark:hover:bg-midnight-800'
              }`}
              title={isMuted ? 'Activar música' : 'Silenciar música'}
              aria-label={isMuted ? 'Activar música' : 'Silenciar música'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-white/90 dark:bg-midnight-900/90 backdrop-blur-md border-b border-lavender-200/80 dark:border-midnight-700/80">
        <button
          onClick={() => onSelectSection('dashboard')}
          className="flex items-center gap-2.5 min-w-0"
        >
          <ColdiAvatar pose="default" size="xs" />
          <p className="font-display font-bold text-sm text-[#2E1F3E] dark:text-[#F5EFFC] truncate">
            {appName}
          </p>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onToggleMute}
            className={`p-2 rounded-2xl ${
              isMuted
                ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300'
                : 'bg-lavender-100/80 dark:bg-midnight-800 text-accent dark:text-lavender-300'
            }`}
            aria-label={isMuted ? 'Activar música' : 'Silenciar música'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onToggleColorMode}
            className="p-2 rounded-2xl bg-lavender-100/80 dark:bg-midnight-800 text-accent dark:text-amber-300"
            aria-label="Cambiar tema claro u oscuro"
          >
            {colorMode === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Mobile Bottom Navigation (all sections in same order as desktop, swipeable horizontally) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-midnight-900/95 backdrop-blur-md border-t border-lavender-200/80 dark:border-midnight-700/80 shadow-soft-lg">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar px-2 py-1.5 snap-x">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            const showAlertDot = item.id === 'calendar' && hasExamAlert;
            return (
              <button
                key={item.id}
                ref={isActive ? activeMobileBtnRef : null}
                onClick={() => onSelectSection(item.id)}
                className={`relative shrink-0 min-w-[64px] snap-center flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-2xl transition-all ${
                  isActive
                    ? 'text-accent dark:text-lavender-300 bg-lavender-100/85 dark:bg-midnight-800 font-semibold'
                    : 'text-[#7E6B96] dark:text-[#9C88B6]'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] leading-tight whitespace-nowrap">{item.shortLabel}</span>
                {showAlertDot && (
                  <span className="absolute top-1 right-2.5 w-2 h-2 rounded-full bg-blush-500" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
