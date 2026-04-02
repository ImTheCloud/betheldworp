import { useState, useCallback } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/Firebase";
import { syncChurchBot, isBotSuggestionUseful } from "../services/churchSyncBot";
import { 
    fetchGooglePlaceData, 
    PENTECOSTAL_NAMES, 
    shuffleArray, 
    normalizeText,
    emptyChurch 
} from "../utils/churchHelpers";

/**
 * useChurchSync Hook
 * Centralizes all automation logic: individual sync, bulk sync, and discovery.
 * Shared progress state for all bot actions.
 */
export function useChurchSync() {
    const [isSyncing, setIsSyncing] = useState(false);
    const [progress, setProgress] = useState({ 
        current: 0, 
        total: 0, 
        suggestionsCreated: 0, 
        churchName: "", 
        status: "",
        progress: 0,
        foundChurch: null 
    });

    const updateStatus = (msg) => setProgress(prev => ({ ...prev, status: msg }));

    // --- SYNC INDIVIDUAL ---
    const syncSingleChurch = useCallback(async (churchData) => {
        setIsSyncing(true);
        const name = churchData.name || "l'église";
        setProgress({ 
            current: 0, 
            total: 0, 
            suggestionsCreated: 0, 
            churchName: name, 
            status: `Initialisation de la synchronisation...`,
            progress: 30,
            foundChurch: null
        });

        try {
            const enrichedData = await syncChurchBot(churchData, updateStatus);
            setProgress(prev => ({ ...prev, progress: 100, status: "Synchronisation terminée !" }));
            return enrichedData;
        } catch (error) {
            console.error("Single Sync Hook Error:", error);
            throw error;
        } finally {
            await new Promise(r => setTimeout(r, 600));
            setIsSyncing(false);
        }
    }, []);

    // --- BULK SYNC ---
    const performBulkSync = useCallback(async (churches, onComplete) => {
        setIsSyncing(true);
        setProgress({ 
            current: 0, 
            total: churches.length, 
            suggestionsCreated: 0, 
            churchName: "", 
            status: "Initialisation du bot de masse...",
            progress: 0,
            foundChurch: null
        });

        let suggestionsCreatedCount = 0;

        for (let i = 0; i < churches.length; i++) {
            const church = churches[i];
            setProgress(prev => ({ 
                ...prev, 
                current: i + 1, 
                churchName: church.name,
                status: `Début du traitement de : ${church.name}`
            }));

            try {
                // Pass updateStatus to see individual steps in the modal during bulk sync
                const googleAndWebData = await syncChurchBot(church, updateStatus);
                
                if (googleAndWebData && isBotSuggestionUseful(church, googleAndWebData)) {
                    await addDoc(collection(db, "church_suggestions"), {
                        type: "edit",
                        status: "pending",
                        source: "auto_sync_bot",
                        originalChurchId: church.id,
                        data: {
                            ...googleAndWebData,
                            syncedAt: serverTimestamp()
                        },
                        createdAt: serverTimestamp(),
                        submitter: { name: "Zero-Cost Sync Bot", at: serverTimestamp() }
                    });
                    suggestionsCreatedCount++;
                    setProgress(prev => ({ ...prev, suggestionsCreated: suggestionsCreatedCount }));
                }
            } catch (err) {
                console.error(`Bulk Sync Hook: Failed for ${church.name}:`, err);
            }

            await new Promise(r => setTimeout(r, 400));
        }

        setIsSyncing(false);
        if (onComplete) onComplete(suggestionsCreatedCount);
    }, []);

    // --- DISCOVERY (FIND NEW CHURCHES) ---
    const performDiscovery = useCallback(async (cityToSearch, countryToSearch, existingChurches = [], onComplete) => {
        setIsSyncing(true);
        const namesToTry = shuffleArray(PENTECOSTAL_NAMES);
        
        setProgress({ 
            current: 0, 
            total: namesToTry.length, 
            suggestionsCreated: 0, 
            churchName: "", 
            status: "Exploration des églises potentielles...",
            progress: 0,
            foundChurch: null
        });

        let foundResult = null;

        for (let i = 0; i < namesToTry.length; i++) {
            const churchName = namesToTry[i];
            const currentProgress = Math.round(((i + 1) / namesToTry.length) * 100);
            
            setProgress(prev => ({ 
                ...prev, 
                current: i + 1, 
                status: `Recherche de : "Biserica Penticostala ${churchName}"`,
                progress: currentProgress
            }));

            try {
                const data = await fetchGooglePlaceData(`Biserica Penticostala ${churchName}`, cityToSearch, countryToSearch);
                
                if (data && (data.name || data.place_id)) {
                    const normName = normalizeText(data.name || "");
                    const normLoc = normalizeText(data.locationTitle || "");
                    const isPentecostal = normName.includes("penticost") || normName.includes("pentecost") ||
                                        normLoc.includes("penticost") || normLoc.includes("pentecost");
                    
                    if (!isPentecostal) continue;

                    if (data.country && countryToSearch && normalizeText(data.country) !== normalizeText(countryToSearch)) continue;
                    if (data.city && cityToSearch && normalizeText(data.city) !== normalizeText(cityToSearch)) continue;

                    const isDuplicate = existingChurches.some(c => 
                        (c.place_id && c.place_id === data.place_id) || 
                        (normalizeText(c.name) === normalizeText(data.name) && normalizeText(c.city) === normalizeText(data.city || cityToSearch))
                    );
                    
                    if (!isDuplicate) {
                        // FOUND ONE
                        foundResult = data;
                        setProgress(prev => ({ ...prev, status: `Trouvé : ${data.name}! Enrichissement en cours...`, progress: 90 }));
                        
                        // DEEP ENRICHMENT
                        const deeplyEnriched = await syncChurchBot({
                            ...emptyChurch(),
                            ...data,
                            country: data.country || countryToSearch,
                            city: data.city || cityToSearch
                        }, updateStatus);
                        
                        foundResult = { ...data, ...deeplyEnriched };
                        break; 
                    }
                }
            } catch (err) {
                console.error("Discovery Hook: failed query for", churchName, err);
            }

            await new Promise(r => setTimeout(r, 400));
        }

        setIsSyncing(false);
        if (onComplete) onComplete(foundResult);
    }, []);

    return {
        isSyncing,
        progress,
        syncSingleChurch,
        performBulkSync,
        performDiscovery
    };
}
