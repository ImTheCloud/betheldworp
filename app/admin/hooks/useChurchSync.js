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
        const name = churchData.name || "church";
        setProgress({ 
            current: 0, 
            total: 0, 
            suggestionsCreated: 0, 
            churchName: name, 
            status: `Initializing synchronization...`,
            progress: 30,
            foundChurch: null
        });

        try {
            const enrichedData = await syncChurchBot(churchData, updateStatus);
            setProgress(prev => ({ ...prev, progress: 100, status: "Sync complete!" }));
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
            status: "Initializing Sync All...",
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
                status: `Syncing: ${church.name}`
            }));

            try {
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

    return {
        isSyncing,
        progress,
        syncSingleChurch,
        performBulkSync
    };
}
