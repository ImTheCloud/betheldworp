/**
 * Shared administrative UI helpers for standardized behavior across the admin panel.
 */

/**
 * Standardizes the toggle expansion logic with an "Unsaved Changes" check.
 * 
 * @param {Object} options
 * @param {string} options.id - The ID of the item being toggled.
 * @param {Array} options.items - The original data list.
 * @param {Object} options.draftsById - The current drafts (local edits).
 * @param {Function} options.isDirtyFn - A function (item, draft) => boolean that returns true if changes exist.
 * @param {Function} options.setModal - The state setter for the ConfirmModal.
 * @param {Function} options.setExpandedIds - The state setter for the Set of expanded IDs.
 * @param {Function} options.setDraftsById - (Optional) The state setter to reset a draft to its original state.
 */
export function toggleExpandWithConfirm({
    id,
    items,
    draftsById,
    isDirtyFn,
    setModal,
    setExpandedIds,
    setDraftsById
}) {
    const key = String(id).trim();
    if (!key) return;

    setExpandedIds(prev => {
        const next = new Set(prev);
        if (next.has(key)) {
            const item = items.find(i => i.id === key);
            // If item has no id property (some sections might have raw data), we might need to adjust
            const draft = draftsById[key];
            
            if (item && draft && isDirtyFn(item, draft)) {
                setModal({
                    isOpen: true,
                    title: "Unsaved Changes",
                    message: "You have unsaved changes. Are you sure you want to cancel them and close?",
                    onConfirm: () => {
                        setModal({ isOpen: false });
                        if (setDraftsById) {
                            // Reset local draft to original item data
                            setDraftsById(d => ({ ...d, [key]: { ...item } }));
                        }
                        // Actually collapse now
                        setExpandedIds(curr => {
                            const n = new Set(curr);
                            n.delete(key);
                            return n;
                        });
                    }
                });
                return prev; // Keep expanded until confirmed
            }
            next.delete(key); // No changes, safe to collapse
        } else {
            next.add(key); // Expanding is always safe
        }
        return next;
    });
}

/**
 * Version for single items (not in a list, like "Current Verse")
 */
export function toggleSingleExpandWithConfirm({
    item,
    draft,
    isDirtyFn,
    setModal,
    setExpanded,
    onResetDraft
}) {
    setExpanded(prev => {
        if (prev) {
            // Trying to collapse while expanded
            if (item && draft && isDirtyFn(item, draft)) {
                setModal({
                    isOpen: true,
                    title: "Unsaved Changes",
                    message: "You have unsaved changes. Are you sure you want to cancel them and close?",
                    onConfirm: () => {
                        setModal({ isOpen: false });
                        if (onResetDraft) onResetDraft();
                        setExpanded(false);
                    }
                });
                return true;
            }
            return false;
        }
        return true;
    });
}
