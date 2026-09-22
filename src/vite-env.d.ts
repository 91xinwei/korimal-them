/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STATIC_IP_API_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
