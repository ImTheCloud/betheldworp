"use client";

import "./About.css";
import { useMemo } from "react";
import { useLang } from "../components/LanguageProvider";
import { makeT } from "../lib/i18n";
import tr from "../translations/About.json";

export default function About() {
    const { lang } = useLang();
    const t = useMemo(() => makeT(tr, lang), [lang]);

    return (
        <section className="about-section">
            <div className="about-content">
                <div className="about-grid">

                    {/* WHO WE ARE */}
                    <article className="about-card">
                        <h2 className="about-card-title">{t("who_title")}</h2>

                        <div className="about-paragraphs">
                            <p className="about-paragraph">{t("who_p1")}</p>
                            <p className="about-paragraph">{t("who_p2")}</p>

                            <p className="about-paragraph">{t("who_points_intro")}</p>
                            <ul className="about-list">
                                <li>{t("who_point1")}</li>
                                <li>{t("who_point2")}</li>
                                <li>{t("who_point3")}</li>
                            </ul>

                            <p className="about-goal">
                                <strong>
                                    <span className="about-goal-label">
                                        {t("who_goal_label")}
                                    </span>{" "}
                                    {t("who_goal_text")}
                                </strong>
                            </p>
                        </div>
                    </article>

                    {/* VISION */}
                    <article className="about-card about-card--vision">
                        <h2 className="about-card-title">{t("vision_title")}</h2>

                        <div className="about-paragraphs">
                            <p className="about-paragraph">{t("vision_p1")}</p>
                            <p className="about-paragraph">{t("vision_p2")}</p>

                            <p className="about-paragraph">{t("vision_points_intro")}</p>
                            <ul className="about-list">
                                <li>{t("vision_point1")}</li>
                                <li>{t("vision_point2")}</li>
                                <li>{t("vision_point3")}</li>
                            </ul>

                            <p className="about-goal">
                                <strong>
                                    <span className="about-goal-label">
                                        {t("vision_goal_label")}
                                    </span>{" "}
                                    {t("vision_goal_text")}
                                </strong>
                            </p>
                        </div>
                    </article>

                </div>
            </div>
        </section>
    );
}