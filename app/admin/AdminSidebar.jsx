"use client";

import "./Admin.css";
import { useEffect, useState } from "react";
import { collection, doc, getDocFromServer, onSnapshot, query, where } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../lib/Firebase";
import Link from "next/link";

function IconChart(props) {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
            <path d="M12 20V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M18 20V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M6 20v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconMail(props) {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
            <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M22 6L12 13L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconBook(props) {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconEdit(props) {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconEvent(props) {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconExternal(props) {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M15 3h6v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10 14L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconLogout(props) {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
            <path
                d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconChurch(props) {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconBell(props) {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export default function AdminSidebar({ activeTab, onTabChange, onLogout }) {
    const [pendingCount, setPendingCount] = useState(0);
    const [draftChurchesCount, setDraftChurchesCount] = useState(0);

    useEffect(() => {
        let unsubSug = () => { };
        let unsubChurches = () => { };
        let stopped = false;

        // A denied read here means the rules engine evaluated isAdmin() as false. Probe the
        // server once to tell apart the only two causes, instead of guessing from symptoms.
        let probed = false;
        const probeSession = async () => {
            if (probed) return;
            probed = true;
            const u = getAuth().currentUser;
            if (!u) {
                console.warn("[diagnostic] No signed-in user in the SDK at all.");
                return;
            }
            try {
                const snap = await getDocFromServer(doc(db, "admins", u.uid));
                console.warn(
                    `[diagnostic] Server read of admins/${u.uid} SUCCEEDED, exists=${snap.exists()}. ` +
                    (snap.exists()
                        ? "Session valid AND the admin document exists: the rules engine should have allowed the read."
                        : "The session is valid but no admin document exists for this UID.")
                );
            } catch (e) {
                console.warn(
                    `[diagnostic] Server read of admins/${u.uid} FAILED with "${e?.code}": ` +
                    "the server does not see a valid session for this browser."
                );
            }
        };

        // Firestore keeps re-establishing a rejected listener, so a denied read floods the
        // console with the same error. Detach on failure and report it once instead.
        const handleError = (label, detach) => (err) => {
            if (stopped) return;
            detach();
            if (err?.code === "permission-denied") {
                console.warn(`AdminSidebar: no read access to "${label}", badge count hidden.`);
                probeSession();
            } else {
                console.error(`AdminSidebar ${label} snapshot error:`, err);
            }
        };

        // Suggestions pending count
        const qSug = query(collection(db, "church_suggestions"), where("status", "==", "pending"));
        unsubSug = onSnapshot(
            qSug,
            (snap) => setPendingCount(snap.size),
            handleError("church_suggestions", () => unsubSug())
        );

        // Draft churches count
        const qChurches = query(collection(db, "churches"), where("isDraft", "==", true));
        unsubChurches = onSnapshot(
            qChurches,
            (snap) => setDraftChurchesCount(snap.size),
            handleError("churches", () => unsubChurches())
        );

        return () => {
            stopped = true;
            unsubSug();
            unsubChurches();
        };
    }, []);

    const navItems = [
        { id: "stats", label: "Statistics", icon: IconChart },
        { id: "newsletter", label: "Newsletter", icon: IconMail },
        { id: "verse", label: "Monthly Verse", icon: IconBook },
        { id: "overrides", label: "Program Overrides", icon: IconEdit },
        { id: "events", label: "Events", icon: IconEvent },
        { id: "churches", label: "Churches", icon: IconChurch, badge: draftChurchesCount > 0 ? draftChurchesCount : null, dividerBefore: true },
        { id: "suggestions", label: "Suggestions", icon: IconBell, badge: pendingCount > 0 ? pendingCount : null },
    ];

    return (
        <aside className="adminSidebar">
            <div className="adminSidebarHeader">
                <img src="/icon.png" alt="Bethel Logo" className="adminMarkSmall" />
                <div className="adminSidebarTitle">Bethel Admin</div>
            </div>

            <nav className="adminSidebarNav">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <span key={item.id} style={{ display: "contents" }}>
                            {item.dividerBefore && (
                                <div style={{ height: 1, background: "rgba(10, 42, 67, 0.08)", margin: "8px 0" }} />
                            )}
                            <button
                                type="button"
                                className={`adminSidebarLink ${activeTab === item.id ? "is-active" : ""}`}
                                onClick={() => onTabChange(item.id)}
                            >
                                <span className="adminSidebarIcon">
                                    <Icon />
                                </span>
                                {item.label}
                                {item.badge && (
                                    <span className="adminSidebarBadge">{item.badge}</span>
                                )}
                            </button>
                        </span>
                    );
                })}
            </nav>

            <div className="adminSidebarFooter">
                <Link href="/" target="_blank" className="adminSidebarLink adminSidebarLink--sub">
                    <span className="adminSidebarIcon">
                        <IconExternal />
                    </span>
                    Go to Website
                </Link>

                <Link href="/romanian-pentecostal-churches-map" target="_blank" className="adminSidebarLink adminSidebarLink--sub">
                    <span className="adminSidebarIcon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                            <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></circle>
                        </svg>
                    </span>
                    World Church Map
                </Link>

                <button type="button" className="adminSidebarLink adminSidebarLink--sub" onClick={onLogout}>
                    <span className="adminSidebarIcon">
                        <IconLogout />
                    </span>
                    Logout
                </button>
            </div>
        </aside>
    );
}
