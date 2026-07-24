import { useEffect, useState } from "react";
import type { UserLang } from "../types/settings";
import { fetchSettings, saveSettings } from "../services/api/api-client";

/**
 * Topbar language switch. Writes the same preference the bot reads, so flipping it here
 * changes every localized bot reply too.
 */
export function LangToggle({ enabled }: { enabled: boolean }) {
    const [lang, setLang] = useState<UserLang | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;
        fetchSettings()
            .then((settings) => { if (!cancelled) setLang(settings.lang); })
            .catch(() => null);
        return () => { cancelled = true; };
    }, [enabled]);

    async function toggle() {
        if (!lang || busy) return;
        const next: UserLang = lang === "en" ? "ar" : "en";
        setBusy(true);
        try {
            const saved = await saveSettings({ lang: next });
            setLang(saved.lang);
        } catch { /* keep the previous language */ } finally {
            setBusy(false);
        }
    }

    if (!lang) return null;

    return (
        <button
            type="button"
            className="lang-toggle"
            title={lang === "en" ? "التبديل إلى العربية" : "Switch to English"}
            disabled={busy}
            onClick={toggle}
        >
            {lang === "en" ? "EN" : "ع"}
        </button>
    );
}
