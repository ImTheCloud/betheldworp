const fs = require('fs');
const file = '/Users/claudiupopadiuc/Documents/GitHub/betheldworp/app/admin/sections/EventsAdmin.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Add dateToSlotIds
if (!content.includes('function dateToSlotIds')) {
    content = content.replace(
        'function IconOverride',
        'function dateToSlotIds(dateStr) {\n    if (!dateStr) return [];\n    const d = new Date(`${dateStr}T12:00:00Z`);\n    if (isNaN(d)) return [];\n    const day = d.getUTCDay();\n    const map = { 0: ["sun_am", "sun_pm"], 1: ["mon"], 2: ["tue"], 3: ["wed"], 4: ["thu"], 5: ["fri"], 6: ["sat"] };\n    return map[day] ?? [];\n}\n\nfunction IconOverride'
    );
}

// 2. EventCard Signature
content = content.replace(
    'function EventCard({ item, expanded, draft, saveState, activeLang, onToggle, onLangChange, onChangeField, onSave, onDelete, onOverrideWeek }) {',
    'function EventCard({ item, expanded, draft, saveState, activeLang, onToggle, onLangChange, onChangeField, onSave, onDelete, isEventOverride }) {'
);

// 3. Remove override link & replace with checkbox
content = content.replace(
    /\{onOverrideWeek && date && \([\s\S]*?<\/button>\s*\)\}/m,
    `<label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600', color: '#0a2a43', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={draft?.isOverride !== undefined ? draft.isOverride : isEventOverride}
                            onChange={(e) => onChangeField(id, "isOverride", null, e.target.checked)}
                        />
                        Override default program for this day
                    </label>`
);

// 4. NewEventCard checkbox
content = content.replace(
    /<div className="adminMsgActions">\s*<button type="button" className="adminDeleteBtn"/,
    `<label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '13px', fontWeight: '600', color: '#0a2a43', cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={draft?.isOverride !== undefined ? draft.isOverride : true}
                        onChange={(e) => onChangeField("isOverride", null, e.target.checked)}
                    />
                    Override default program for this day
                </label>\n                <div className="adminMsgActions">\n                    <button type="button" className="adminDeleteBtn"`
);

// 5. Add overrides state in EventsAdmin
if (!content.includes('const [overrides, setOverrides] = useState([]))')) {
    content = content.replace(
        /const \[loading, setLoading\] = useState\(true\);\n/,
        `const [loading, setLoading] = useState(true);\n    const [overrides, setOverrides] = useState([]);\n`
    );
}

// 6. Fetch overrides
if (!content.includes('collection(db, "program_overrides")')) {
    content = content.replace(
        /useEffect\(\(\) => \{\n        setLoading\(true\);\n\n        const unsub = onSnapshot\(\n            collection\(db, "events"\),/m,
        `useEffect(() => {\n        setLoading(true);\n\n        const unsubEvents = onSnapshot(\n            collection(db, "events"),`
    );
    
    content = content.replace(
        /        return \(\) => unsub\(\);\n    \}, \[\]\);/m,
        `    const unsubOverrides = onSnapshot(collection(db, "program_overrides"), (snap) => {\n            if (!mountedRef.current) return;\n            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));\n            setOverrides(list);\n        });\n\n        return () => {\n            unsubEvents();\n            unsubOverrides();\n        };\n    }, []);`
    );
}

// 7. Add isEventOverride and syncOverride helpers
const helpers = `
    const isEventOverride = useCallback((eventId, dateStr) => {
        if (!eventId || !dateStr) return false;
        const wk = dateToWeekKey(dateStr);
        if (!wk) return false;
        const override = overrides.find(o => o.id === wk || o.weekKey === wk);
        if (!override) return false;
        return Object.values(override.replacements || {}).includes(eventId);
    }, [overrides]);

    const syncOverride = async (eventId, dateStr, isOverride, oldEventId = null, oldDateStr = null) => {
        if (!eventId || !dateStr) return;

        if (oldEventId && oldDateStr && (oldEventId !== eventId || oldDateStr !== dateStr)) {
            const oldWk = dateToWeekKey(oldDateStr);
            const oldSlots = dateToSlotIds(oldDateStr);
            if (oldWk && oldSlots.length > 0) {
                const oldOverride = overrides.find(o => o.id === oldWk || o.weekKey === oldWk);
                if (oldOverride && oldOverride.replacements) {
                    const newReps = { ...oldOverride.replacements };
                    let changed = false;
                    for (const s of oldSlots) {
                        if (newReps[s] === oldEventId) {
                            delete newReps[s];
                            changed = true;
                        }
                    }
                    if (changed) {
                        await setDoc(doc(db, "program_overrides", oldWk), { replacements: newReps }, { merge: true });
                    }
                }
            }
        }

        const wk = dateToWeekKey(dateStr);
        const slots = dateToSlotIds(dateStr);
        if (!wk || slots.length === 0) return;

        const overrideDoc = overrides.find(o => o.id === wk || o.weekKey === wk);
        const base = overrideDoc || { weekKey: wk, affectedProgramIds: [], replacements: {} };
        const newReplacements = { ...(base.replacements || {}) };
        
        let changed = false;
        if (isOverride) {
            slots.forEach(s => {
                if (newReplacements[s] !== eventId) {
                    newReplacements[s] = eventId;
                    changed = true;
                }
            });
            const newAffected = [...new Set([...(base.affectedProgramIds || []), ...slots])];
            if (changed || base.affectedProgramIds?.length !== newAffected.length) {
                await setDoc(doc(db, "program_overrides", wk), {
                    ...base,
                    affectedProgramIds: newAffected,
                    replacements: newReplacements
                }, { merge: true });
            }
        } else {
            if (overrideDoc) {
                slots.forEach(s => {
                    if (newReplacements[s] === eventId) {
                        delete newReplacements[s];
                        changed = true;
                    }
                });
                if (changed) {
                    await setDoc(doc(db, "program_overrides", wk), { replacements: newReplacements }, { merge: true });
                }
            }
        }
    };
`;
if (!content.includes('const syncOverride')) {
    content = content.replace(
        'const deleteOne = async (id) => {',
        helpers + '\n    const deleteOne = async (id) => {'
    );
}

// 8. Call syncOverride in saveOne
content = content.replace(
    /await setDoc\(doc\(db, "events", key\), d, \{ merge: true \}\);/g,
    `await setDoc(doc(db, "events", key), d, { merge: true });\n                const isOv = draft.isOverride !== undefined ? draft.isOverride : isEventOverride(original.id, original.dateEvent);\n                await syncOverride(key, d.dateEvent, isOv, key, original.dateEvent);`
);

content = content.replace(
    /const ref = doc\(collection\(db, "events"\)\);\n\s*await setDoc\(ref, d\);/g,
    `const ref = doc(collection(db, "events"));\n                await setDoc(ref, d);\n                const isOv = draft?.isOverride !== undefined ? draft.isOverride : (original ? isEventOverride(original.id, original.dateEvent) : true);\n                await syncOverride(ref.id, d.dateEvent, isOv);`
);

// 9. Call syncOverride in deleteOne
content = content.replace(
    /await deleteDoc\(doc\(db, "events", key\)\);/g,
    `const original = items.find((x) => x.id === key);\n                    await deleteDoc(doc(db, "events", key));\n                    if (original) await syncOverride(key, original.dateEvent, false);`
);

// 10. Pass isEventOverride to EventCard
content = content.replace(
    /onOverrideWeek=\{requestOverride\}/g,
    `isEventOverride={isEventOverride(it.id, it.dateEvent)}`
);

fs.writeFileSync(file, content);
console.log('Patched');
