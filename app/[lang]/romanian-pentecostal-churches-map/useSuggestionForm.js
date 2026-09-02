"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/Firebase";
import { isValidEmail } from "../../lib/validation";
import { useLang } from "../../components/LanguageProvider";
import { makeT } from "../../lib/i18n";
import worldMapTranslations from "../../translations/WorldMap.json";
import { SUGGESTION_RETENTION_DAYS } from "./mapData";
import { normalizeText } from "./mapHelpers";

// Toute la proposition d'église : les états du formulaire en deux étapes, le
// brouillon gardé en localStorage, la détection de doublon et l'envoi vers
// Firestore. La carte n'en garde que le bouton d'ouverture et l'affichage.
//
// Le brouillon existe pour une raison précise : changer de langue remonte le
// composant, et sans lui le visiteur perdait tout ce qu'il venait de taper.

const SUGGESTION_DRAFT_KEY = "bethel_suggestion_draft";
const SUBMITTER_KEY = "bethel_submitter";

const FORMULAIRE_VIDE = {
    name: "",
    city: "",
    zipCode: "",
    street: "",
    number: "",
    phone: "",
    email: "",
    website: "",
    youtube: "",
    facebook: "",
    instagram: "",
    country: "Belgium",
    locationTitle: ""
};

const PROPOSANT_VIDE = {
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    notes: ""
};

function lireBrouillon() {
    if (typeof window === "undefined") return null;
    try {
        const saved = localStorage.getItem(SUGGESTION_DRAFT_KEY);
        return saved ? JSON.parse(saved) : null;
    } catch (e) {
        console.error("Failed to parse suggestion draft:", e);
        return null;
    }
}

// Reprend les coordonnées déjà saisies lors d'une proposition précédente. Les
// notes sont volontairement laissées vides : elles décrivent une église, pas
// la personne, et n'ont pas de sens d'une proposition à l'autre.
function lireProposantEnregistre() {
    try {
        const saved = localStorage.getItem(SUBMITTER_KEY);
        if (!saved) return PROPOSANT_VIDE;
        const parsed = JSON.parse(saved);
        return {
            firstName: parsed.firstName || "",
            lastName: parsed.lastName || "",
            phone: parsed.phone || "",
            email: parsed.email || "",
            notes: ""
        };
    } catch (e) {
        console.error("Failed to load saved submitter info:", e);
        return PROPOSANT_VIDE;
    }
}

function champsDepuisEglise(church) {
    return {
        name: church.name || "",
        city: church.city || "",
        zipCode: church.zipCode || "",
        street: church.street || "",
        number: church.number || "",
        phone: church.phone || "",
        email: church.email || "",
        website: church.website || "",
        youtube: church.youtube || "",
        facebook: church.facebook || "",
        instagram: church.instagram || "",
        country: church.country || "Romania",
        locationTitle: church.locationTitle || ""
    };
}

export function useSuggestionForm({ churches, selectedChurch, setSelectedChurch, selectChurch, activeCountryFilter }) {
    const { lang } = useLang();
    const t = makeT(worldMapTranslations, lang);

    // Lu une seule fois : ces valeurs ne servent qu'à initialiser les états
    // ci-dessous, les relire à chaque rendu ne changerait rien.
    const brouillonRef = useRef(null);
    if (!brouillonRef.current) brouillonRef.current = { valeur: lireBrouillon() };
    const initialDraft = brouillonRef.current.valeur;

    const [showSuggestionModal, setShowSuggestionModal] = useState(!!initialDraft?.showSuggestionModal);
    const [duplicateChurchModal, setDuplicateChurchModal] = useState({ isOpen: false, church: null });
    const [suggestionType, setSuggestionType] = useState(initialDraft?.suggestionType || "new");
    const [suggestionForm, setSuggestionForm] = useState(initialDraft?.suggestionForm || FORMULAIRE_VIDE);
    const [suggestionStep, setSuggestionStep] = useState(initialDraft?.suggestionStep || 1);
    const [submitterForm, setSubmitterForm] = useState(initialDraft?.submitterForm || PROPOSANT_VIDE);
    const [pendingEditChurchId, setPendingEditChurchId] = useState(initialDraft?.selectedChurchId || null);
    const [suggestionSuccess, setSuggestionSuccess] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState("");
    const [initialFormValues, setInitialFormValues] = useState(null);

    const isRestored = useRef(false);
    useEffect(() => {
        isRestored.current = true;
    }, []);

    // Reprise : si le brouillon portait sur une modification, on retrouve
    // l'église concernée dès que la liste est chargée.
    useEffect(() => {
        if (pendingEditChurchId && churches?.length > 0 && !selectedChurch) {
            const church = churches.find(c => c.id === pendingEditChurchId);
            if (church) {
                setSelectedChurch(church);
                setPendingEditChurchId(null);
            }
        }
    }, [churches, pendingEditChurchId, selectedChurch, setSelectedChurch]);

    // Sauvegarde continue, pour survivre à un changement de langue.
    useEffect(() => {
        if (!isRestored.current) return;

        const draft = {
            suggestionForm,
            submitterForm,
            suggestionStep,
            suggestionType,
            showSuggestionModal,
            selectedChurchId: suggestionType === "edit" ? selectedChurch?.id : null
        };
        localStorage.setItem(SUGGESTION_DRAFT_KEY, JSON.stringify(draft));
    }, [suggestionForm, submitterForm, suggestionStep, suggestionType, showSuggestionModal, selectedChurch]);

    const clearSuggestionDraft = useCallback(() => {
        localStorage.removeItem(SUGGESTION_DRAFT_KEY);
        setPendingEditChurchId(null);
    }, []);

    const findDuplicateChurch = useCallback((name, city) => {
        const normalizedName = normalizeText(String(name || "").trim());
        const normalizedCity = normalizeText(String(city || "").trim());
        if (!normalizedName || !normalizedCity) return null;

        return churches.find((church) => (
            normalizeText(String(church.name || "").trim()) === normalizedName &&
            normalizeText(String(church.city || "").trim()) === normalizedCity
        )) || null;
    }, [churches]);

    const openSuggestionModal = useCallback((type = "new", church = null) => {
        setSuggestionType(type);

        const data = type === "edit" && church
            ? champsDepuisEglise(church)
            : { ...FORMULAIRE_VIDE, country: activeCountryFilter || "Romania" };

        setSuggestionForm(data);
        setInitialFormValues(data);
        setSuggestionStep(1);
        setSubmitterForm(lireProposantEnregistre());
        setShowSuggestionModal(true);
        setSuggestionSuccess(false);
        setFormError("");
    }, [activeCountryFilter]);

    const closeSuggestionModal = useCallback(() => {
        clearSuggestionDraft();
        setShowSuggestionModal(false);
    }, [clearSuggestionDraft]);

    const closeDuplicateChurchModal = useCallback(() => {
        setDuplicateChurchModal({ isOpen: false, church: null });
    }, []);

    // Une église du même nom dans la même ville existe déjà : on bascule le
    // visiteur sur une modification de celle-ci plutôt que sur un doublon.
    const handleDuplicateChurchRedirect = useCallback(() => {
        const duplicateChurch = duplicateChurchModal.church;
        if (!duplicateChurch) return;

        setDuplicateChurchModal({ isOpen: false, church: null });
        setShowSuggestionModal(false);
        setFormError("");
        setSuggestionStep(1);
        selectChurch(duplicateChurch);
        setTimeout(() => {
            openSuggestionModal("edit", duplicateChurch);
        }, 0);
    }, [duplicateChurchModal.church, selectChurch, openSuggestionModal]);

    const hasChanges = useMemo(() => {
        if (!initialFormValues) return false;
        return JSON.stringify(suggestionForm) !== JSON.stringify(initialFormValues);
    }, [suggestionForm, initialFormValues]);

    const handleSuggestionSubmit = async (e) => {
        if (e) e.preventDefault();

        if (suggestionStep === 1) {
            if (!suggestionForm.name || !suggestionForm.city) {
                setFormError(t("errorNameCityRequired"));
                return;
            }
            if (suggestionType === "new") {
                const duplicateChurch = findDuplicateChurch(suggestionForm.name, suggestionForm.city);
                if (duplicateChurch) {
                    setFormError("");
                    setDuplicateChurchModal({ isOpen: true, church: duplicateChurch });
                    return;
                }
            }
            if (suggestionType === "edit" && !hasChanges) {
                setFormError(t("errorNoChanges"));
                return;
            }
            if (suggestionForm.email && !isValidEmail(suggestionForm.email)) {
                setFormError(t("errorInvalidEmail"));
                return;
            }
            setFormError("");
            setSuggestionStep(2);
            return;
        }

        if (submitterForm.email && !isValidEmail(submitterForm.email)) {
            setFormError(t("errorInvalidEmail"));
            return;
        }

        setIsSubmitting(true);
        try {
            await addDoc(collection(db, "church_suggestions"), {
                type: suggestionType,
                originalChurchId: suggestionType === "edit" ? selectedChurch?.id : null,
                status: "pending",
                data: {
                    ...suggestionForm,
                    submitter: submitterForm
                },
                createdAt: serverTimestamp(),
                expiresAt: new Date(Date.now() + SUGGESTION_RETENTION_DAYS * 24 * 60 * 60 * 1000)
            });

            // Coordonnées gardées pour la prochaine proposition, sans les notes.
            try {
                localStorage.setItem(SUBMITTER_KEY, JSON.stringify({
                    firstName: submitterForm.firstName,
                    lastName: submitterForm.lastName,
                    phone: submitterForm.phone,
                    email: submitterForm.email
                }));
            } catch (e) {
                console.error("Failed to save submitter info:", e);
            }

            setSuggestionSuccess(true);
            clearSuggestionDraft();
            setTimeout(() => {
                setShowSuggestionModal(false);
                setSuggestionSuccess(false);
                setSuggestionStep(1);
            }, 3000);
        } catch (err) {
            console.error(err);
            setFormError(t("errorSending"));
        } finally {
            setIsSubmitting(false);
        }
    };

    return {
        openSuggestionModal,
        modalProps: {
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
            closeSuggestionModal
        },
        duplicateProps: {
            duplicateChurchModal,
            closeDuplicateChurchModal,
            handleDuplicateChurchRedirect
        }
    };
}
