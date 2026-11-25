/// <reference types="vite/client" />

declare module 'pdfjs-dist/build/pdf.worker.min.mjs?url' {
  const url: string;
  export default url;
}

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_GOOGLE_CLIENT_SECRET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface ColdiDesktopBridge {
  isDesktop: boolean;
  getRedirectUri: () => Promise<string>;
  startGoogleOAuth: (authUrl: string) => Promise<{ code?: string; error?: string; state?: string }>;
  openExternal: (url: string) => Promise<void>;
  getAppVersion?: () => Promise<string>;
  installUpdateNow?: () => Promise<void>;
  onUpdateReady?: (callback: (info: { version: string }) => void) => () => void;
}

interface Window {
  coldiDesktop?: ColdiDesktopBridge;
}
