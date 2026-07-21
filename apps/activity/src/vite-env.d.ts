/// <reference types="vite/client" />

interface ImportMetaEnv {
    /** Discord application (OAuth2) client id — public, safe to expose to the browser. */
    readonly VITE_DISCORD_CLIENT_ID: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
