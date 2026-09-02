"use client";

import { useMemo } from "react";
import { useLang } from "../../components/LanguageProvider";
import { makeT } from "../../lib/i18n";
import worldMapTranslations from "../../translations/WorldMap.json";
import SearchableSelect from "../../components/SearchableSelect";
import { COUNTRY_CODES } from "./mapData";

// Les deux fenetres de la proposition d'eglise : le formulaire en deux etapes,
// et l'avertissement affiche quand une eglise du meme nom existe deja dans la
// meme ville. Elles n'ont aucun etat propre, tout vient de useSuggestionForm.

export function SuggestionModal({
    showSuggestionModal,
    suggestionType,
    suggestionSuccess,
    suggestionStep,
    setSuggestionStep,
    suggestionForm,
    setSuggestionForm,
    submitterForm,
    setSubmitterForm,
    formError,
    isSubmitting,
    hasChanges,
    handleSuggestionSubmit,
    closeSuggestionModal,
    getCountryLabel
}) {
    const { lang } = useLang();
    const t = makeT(worldMapTranslations, lang);
    const SUGGESTION_COUNTRIES = useMemo(() => Object.keys(COUNTRY_CODES).sort(), []);

    if (!showSuggestionModal) return null;

    return (
        <div className="suggestionModalOverlay">
            <div className="suggestionModal">
                <div className="suggestionModalHeader">
                    <h3>{suggestionType === "new" ? t("suggestionTitleNew") : t("suggestionTitleEdit")}</h3>
                </div>

                {suggestionSuccess ? (
                    <div className="suggestionSuccess">
                        <div className="successIcon">✓</div>
                        <p>{t("suggestionSuccess")}</p>
                    </div>
                ) : (
                    <form className="suggestionForm" onSubmit={handleSuggestionSubmit}>
                        {formError && <div className="suggestionError">{formError}</div>}

                        <div className="suggestionFormBody">
                            {/* Visual Stepper */}
                            <div className="suggestionStepper">
                                <div className={`stepItem ${suggestionStep >= 1 ? 'active' : ''} ${suggestionStep > 1 ? 'completed' : ''}`}>
                                    <div className="stepCircle">{suggestionStep > 1 ? '✓' : '1'}</div>
                                    <span>{t("churchInfo")}</span>
                                </div>
                                <div className="stepLine"></div>
                                <div className={`stepItem ${suggestionStep >= 2 ? 'active' : ''}`}>
                                    <div className="stepCircle">2</div>
                                    <span>{t("yourInfo")}</span>
                                </div>
                            </div>

                            {suggestionStep === 1 ? (
                                <div className="suggestionStep1">
                                    <div className="suggestionFormRow">
                                        <div className="suggestionFormGroup">
                                            <label>{t("name")} *</label>
                                            <input
                                                type="text"
                                                required
                                                placeholder={t("churchNamePlaceholder")}
                                                value={suggestionForm.name}
                                                onChange={(e) => setSuggestionForm({ ...suggestionForm, name: e.target.value })}
                                            />
                                        </div>
                                        <div className="suggestionFormGroup">
                                            <label>{t("city")} *</label>
                                            <input
                                                type="text"
                                                required
                                                value={suggestionForm.city}
                                                onChange={(e) => setSuggestionForm({ ...suggestionForm, city: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="suggestionFormRow">
                                        <div className="suggestionFormGroup">
                                            <label>{t("country")}</label>
                                            <SearchableSelect
                                                value={suggestionForm.country}
                                                onChange={(val) => setSuggestionForm({ ...suggestionForm, country: val })}
                                                options={SUGGESTION_COUNTRIES.map(c => ({ value: c, label: getCountryLabel(c) }))}
                                                placeholder=""
                                                inputClassName="suggestionInput" 
                                            />
                                        </div>
                                        <div className="suggestionFormGroup">
                                            <label>{t("postalCode")}</label>
                                            <input
                                                type="text"
                                                value={suggestionForm.zipCode}
                                                onChange={(e) => setSuggestionForm({ ...suggestionForm, zipCode: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="suggestionFormRow">
                                        <div className="suggestionFormGroup" style={{ flex: 3 }}>
                                            <label>{t("street")}</label>
                                            <input
                                                type="text"
                                                value={suggestionForm.street}
                                                onChange={(e) => setSuggestionForm({ ...suggestionForm, street: e.target.value })}
                                            />
                                        </div>
                                        <div className="suggestionFormGroup" style={{ flex: 1 }}>
                                            <label>{t("number")}</label>
                                            <input
                                                type="text"
                                                value={suggestionForm.number}
                                                onChange={(e) => setSuggestionForm({ ...suggestionForm, number: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="suggestionFormRow">
                                        <div className="suggestionFormGroup">
                                            <label>{t("phone")}</label>
                                            <input
                                                type="tel"
                                                value={suggestionForm.phone}
                                                onChange={(e) => setSuggestionForm({ ...suggestionForm, phone: e.target.value.replace(/[^\d+\s\-\(\)]/g, "") })}
                                            />
                                        </div>
                                        <div className="suggestionFormGroup">
                                            <label>{t("email")}</label>
                                            <input
                                                type="email"
                                                value={suggestionForm.email}
                                                onChange={(e) => setSuggestionForm({ ...suggestionForm, email: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="suggestionFormRow">
                                        <div className="suggestionFormGroup">
                                            <label>{t("website")}</label>
                                            <input
                                                type="text"
                                                placeholder="https://..."
                                                value={suggestionForm.website}
                                                onChange={(e) => setSuggestionForm({ ...suggestionForm, website: e.target.value })}
                                            />
                                        </div>
                                        <div className="suggestionFormGroup">
                                            <label>{t("youtube")}</label>
                                            <input
                                                type="text"
                                                placeholder="https://youtube.com/..."
                                                value={suggestionForm.youtube}
                                                onChange={(e) => setSuggestionForm({ ...suggestionForm, youtube: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="suggestionFormRow">
                                        <div className="suggestionFormGroup">
                                            <label>{t("instagram")}</label>
                                            <input
                                                type="text"
                                                placeholder="instagram.com/..."
                                                value={suggestionForm.instagram}
                                                onChange={(e) => setSuggestionForm({ ...suggestionForm, instagram: e.target.value })}
                                            />
                                        </div>
                                        <div className="suggestionFormGroup">
                                            <label>{t("facebook")}</label>
                                            <input
                                                type="text"
                                                placeholder="facebook.com/..."
                                                value={suggestionForm.facebook}
                                                onChange={(e) => setSuggestionForm({ ...suggestionForm, facebook: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                </div>
                            ) : (
                                <div className="suggestionStep2">
                                    <div className="step2Header">
                                        <h4>{t("submitterTitle")}</h4>
                                    </div>

                                    <div className="suggestionFormRow">
                                        <div className="suggestionFormGroup">
                                            <label>{t("lastName")}</label>
                                            <input
                                                type="text"
                                                value={submitterForm.lastName}
                                                onChange={(e) => setSubmitterForm({ ...submitterForm, lastName: e.target.value })}
                                            />
                                        </div>
                                        <div className="suggestionFormGroup">
                                            <label>{t("firstName")}</label>
                                            <input
                                                type="text"
                                                value={submitterForm.firstName}
                                                onChange={(e) => setSubmitterForm({ ...submitterForm, firstName: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="suggestionFormRow">
                                        <div className="suggestionFormGroup">
                                            <label>{t("phone")}</label>
                                            <input
                                                type="tel"
                                                value={submitterForm.phone}
                                                onChange={(e) => setSubmitterForm({ ...submitterForm, phone: e.target.value.replace(/[^\d+\s\-\(\)]/g, "") })}
                                            />
                                        </div>
                                        <div className="suggestionFormGroup">
                                            <label>{t("email")}</label>
                                            <input
                                                type="email"
                                                value={submitterForm.email}
                                                onChange={(e) => setSubmitterForm({ ...submitterForm, email: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="suggestionFormRow">
                                        <div className="suggestionFormGroup" style={{ flex: 1 }}>
                                            <label>{t("notes")}</label>
                                            <textarea
                                                value={submitterForm.notes}
                                                placeholder={t("notesPlaceholder")}
                                                onChange={(e) => setSubmitterForm({ ...submitterForm, notes: e.target.value })}
                                                rows={3}
                                                className="compactTextarea"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="suggestionFormActions">
                            {suggestionStep === 1 ? (
                                <div className="suggestionStep1Actions">
                                    <button
                                        type="button"
                                        className="suggestionCancelBtn"
                                        onClick={closeSuggestionModal}
                                    >
                                        {t("cancel")}
                                    </button>
                                    <button
                                        type="submit"
                                        className="suggestionSubmitBtn"
                                        disabled={isSubmitting || (suggestionType === "edit" && !hasChanges)}
                                    >
                                        {isSubmitting ? "..." : t("nextStep")}
                                    </button>
                                </div>
                            ) : (
                                <div className="step2Actions">
                                    <button
                                        type="button"
                                        className="suggestionSkipBtn"
                                        onClick={() => setSuggestionStep(1)}
                                    >
                                        {t("back")}
                                    </button>
                                    <button
                                        type="submit"
                                        className="suggestionSubmitBtn"
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? "..." : t("skipAndSend")}
                                    </button>
                                </div>
                            )}
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

export function DuplicateChurchModal({
    duplicateChurchModal,
    closeDuplicateChurchModal,
    handleDuplicateChurchRedirect,
    getCountryLabel
}) {
    const { lang } = useLang();
    const t = makeT(worldMapTranslations, lang);

    if (!duplicateChurchModal.isOpen || !duplicateChurchModal.church) return null;

    return (
        <div className="suggestionModalOverlay">
            <div className="suggestionInfoModal" role="dialog" aria-modal="true">
                <div className="suggestionModalHeader">
                    <h3>{t("duplicateChurchTitle")}</h3>
                </div>
                <div className="suggestionInfoModalBody">
                    <p>{t("duplicateChurchMessage")}</p>
                    <div className="suggestionDuplicateTarget">
                        <strong>{duplicateChurchModal.church.name}</strong>
                        <span>
                            {duplicateChurchModal.church.city}
                            {duplicateChurchModal.church.country ? `, ${getCountryLabel(duplicateChurchModal.church.country)}` : ""}
                        </span>
                    </div>
                </div>
                <div className="suggestionInfoModalActions">
                    <button
                        type="button"
                        className="suggestionCancelBtn"
                        onClick={closeDuplicateChurchModal}
                    >
                        {t("cancel")}
                    </button>
                    <button
                        type="button"
                        className="suggestionSubmitBtn"
                        onClick={handleDuplicateChurchRedirect}
                    >
                        {t("duplicateChurchAction")}
                    </button>
                </div>
            </div>
        </div>
    );
}
