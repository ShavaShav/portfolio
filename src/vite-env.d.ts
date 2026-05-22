/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Collector endpoint for the user-analytics capture layer. */
  readonly VITE_ANALYTICS_URL?: string;
  /** Git SHA of the deployed build, injected by deploy.yml. */
  readonly VITE_RELEASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
