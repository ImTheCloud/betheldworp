"use client";

import { useLang } from "../../components/LanguageProvider";
import { makeT } from "../../lib/i18n";
import tr from "../../translations/Privacy.json";
import "./privacy.css";

const CONTACT = "info@betheldworp.be";

// Les sections suivent l'ordre dans lequel un visiteur se pose les questions :
// ce qu'il nous a donné, ce qu'on mesure, à qui ça va, et comment reprendre
// la main.
const SECTIONS = ["s1", "s2", "s3", "s4", "s5", "s6", "s7"];

export default function PrivacyPage() {
    const { lang } = useLang();
    const t = makeT(tr, lang);

    return (
        <main className="privacy">
            <article className="privacy-card">
                <h1 className="privacy-title">{t("title")}</h1>
                <p className="privacy-updated">{t("updated")}</p>

                <p className="privacy-intro" dangerouslySetInnerHTML={{ __html: t("intro") }} />

                {SECTIONS.map((s) => (
                    <section key={s} className="privacy-section">
                        <h2 className="privacy-h2">{t(`${s}t`)}</h2>
                        <p className="privacy-body" dangerouslySetInnerHTML={{ __html: t(`${s}b`) }} />
                    </section>
                ))}

                <section className="privacy-section">
                    <h2 className="privacy-h2">{t("s8t")}</h2>
                    <p className="privacy-body">{t("s8b")}</p>
                    <a className="privacy-mail" href={`mailto:${CONTACT}`}>{CONTACT}</a>
                </section>

                <div className="privacy-back">
                    <a href={`/${lang}`}>← {t("back")}</a>
                </div>
            </article>
        </main>
    );
}
