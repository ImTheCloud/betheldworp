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
        <header className="about-header">
          <h2 className="about-section-title">{t("section_title")}</h2>
        </header>

        <div className="about-grid">

          {/* WHO WE ARE */}
          <article className="about-card">
            <h3 className="about-card-title">{t("who_title")}</h3>

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
                <span className="about-goal-label">{t("who_goal_label")}</span>{" "}
                {t("who_goal_text")}
              </strong>
            </p>
          </article>

          {/* VISION */}
          <article className="about-card about-card--vision">
            <h3 className="about-card-title">{t("vision_title")}</h3>

            <p className="about-paragraph">{t("vision_p1")}</p>
            <p className="about-paragraph">{t("vision_p2")}</p>

            <p className="about-paragraph">{t("vision_points_intro")}</p>
            <ul className="about-list">
              <li>{t("vision_point1")}</li>
              <li>{t("vision_point2")}</li>
              <li>{t("vision_point3")}</li>
            </ul>
          </article>
        </div>

        {/* CONCLUSION */}
        <div className="about-conclusion">
          <h3>{t("conclusion_title")}</h3>
          <p>{t("conclusion_text")}</p>
        </div>

      </div>
    </section>
  );
}
