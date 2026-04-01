import { useState, useCallback } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/Firebase";
import { syncChurchBot, isBotSuggestionUseful } from "../services/churchSyncBot";

export function useChurchSync() {
    const [isSyncing, setIsSyncing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, suggestionsCreated: 0, churchName: "" });

    const syncSingleChurch = useCallback(async (churchData) => {
        setIsSyncing(true);
        try {
            const enrichedData = await syncChurchBot(churchData);
            return enrichedData;
        } catch (error) {
            console.error("Single Sync Hook Error:", error);
            throw error;
        } finally {
            setIsSyncing(false);
        }
    }, []);

    const performBulkSync = useCallback(async (churches, onComplete) => {
        setIsSyncing(true);
        setProgress({ current: 0, total: churches.length, suggestionsCreated: 0, churchName: "" });

        let suggestionsCreatedCount = 0;

        for (let i = 0; i < churches.length; i++) {
            const church = churches[i];
            setProgress(prev => ({ ...prev, current: i + 1, churchName: church.name }));

            try {
                const googleAndWebData = await syncChurchBot(church);
                
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

            // Slight delay to avoid hammering APIs
            await new Promise(r => setTimeout(r, 600));
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
