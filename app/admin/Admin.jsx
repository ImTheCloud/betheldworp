"use client";

import "./Admin.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { doc, getDocFromServer } from "firebase/firestore";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { isValidEmail } from "../lib/validation";
import { db } from "../lib/Firebase";

import MonthlyVerseAdmin from "./sections/MonthlyVerseAdmin";
import ProgramOverridesAdmin from "./sections/ProgramOverridesAdmin";
import EventsAdmin from "./sections/EventsAdmin";
import StatsAdmin from "./sections/StatsAdmin";
import NewsletterAdmin from "./sections/NewsletterAdmin";
import ChurchesAdmin from "./sections/ChurchesAdmin";
import ChurchSuggestionsAdmin from "./sections/ChurchSuggestionsAdmin";
import AdminSidebar from "./AdminSidebar";
import ConfirmModal from "./components/ConfirmModal";
import { useCallback } from "react";

function mapAuthError(code) {
    switch (code) {
        case "auth/invalid-email":
            return "Invalid email.";
        case "auth/user-not-found":
        case "auth/wrong-password":
            return "Wrong email or password.";
        case "auth/too-many-requests":
            return "Too many attempts. Try again later.";
        case "auth/network-request-failed":
            return "Network error. Check your connection.";
        default:
            return "Authentication failed. Try again.";
    }
}

export default function Admin() {
    const auth = useMemo(() => getAuth(), []);
    const mountedRef = useRef(true);

    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);

    const [isAdmin, setIsAdmin] = useState(false);
    const [adminLoading, setAdminLoading] = useState(true);
    const [adminError, setAdminError] = useState("");

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loggingIn, setLoggingIn] = useState(false);
    const [pendingOverride, setPendingOverride] = useState(null);
    const [activeTab, setActiveTab] = useState("stats");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [dirtyTabs, setDirtyTabs] = useState({});

    const [modal, setModal] = useState({ isOpen: false, title: "", message: "", progress: null, actions: null });

    const handleDirtyChange = useCallback((tab, isDirty) => {
        setDirtyTabs(prev => {
            if (prev[tab] === isDirty) return prev;
            return { ...prev, [tab]: isDirty };
        });
    }, []);

    const handleTabChangeAttempt = (newTab) => {
        if (newTab === activeTab) {
            setSidebarOpen(false);
            return;
        }

        if (dirtyTabs[activeTab]) {
            setModal({
                isOpen: true,
                title: "Unsaved Changes",
                message: "You have unsaved changes in this section. If you leave, they will be lost. Continue?",
                actions: [
                    {
                        label: "Stay Here",
                        variant: "secondary",
                        onClick: () => setModal(prev => ({ ...prev, isOpen: false }))
                    },
                    {
                        label: "Leave & Discard",
                        variant: "danger",
                        onClick: () => {
                            handleDirtyChange(activeTab, false);
                            setActiveTab(newTab);
                            setSidebarOpen(false);
                            setModal(prev => ({ ...prev, isOpen: false }));
                        }
                    }
                ]
            });
        } else {
            setActiveTab(newTab);
            setSidebarOpen(false);
        }
    };

    const openInfoModal = useCallback((title, message) => {
        setModal({
            isOpen: true,
            title,
            message,
            actions: [
                {
                    label: "OK",
                    variant: "primary",
                    onClick: () => setModal((prev) => ({ ...prev, isOpen: false }))
                }
            ],
            progress: null
        });
    }, []);

    // Sync hash -> tab (initial & back/forward buttons)
    useEffect(() => {
        if (!isAdmin) return;

        const handleHash = () => {
            const hash = window.location.hash.replace("#", "");
            const validTabs = ["stats", "newsletter", "verse", "overrides", "events", "churches", "suggestions"];
            if (hash && validTabs.includes(hash)) {
                setActiveTab(hash);
            }
        };

        handleHash(); // Run once on admin status granted
        window.addEventListener("popstate", handleHash);
        return () => window.removeEventListener("popstate", handleHash);
    }, [isAdmin]);

    // Sync tab -> hash
    useEffect(() => {
        if (!isAdmin) return;
        if (activeTab && window.location.hash !== `#${activeTab}`) {
            window.history.replaceState(null, null, `#${activeTab}`);
        }
    }, [activeTab, isAdmin]);

    const navigateToOverride = ({ weekKey, eventId, dateStr }) => {
        setPendingOverride({ weekKey, eventId, dateStr });
        setActiveTab("overrides");
        setSidebarOpen(false);
    };

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        const resetTouch = () => {
            touchStartX.current = null;
        };
        window.addEventListener("focus", resetTouch);
        const unsub = onAuthStateChanged(auth, (u) => {
            if (!mountedRef.current) return;
            // Pre-emptively set adminLoading when a user is detected to prevent
            // a 1-render gap where authLoading is false but the user useEffect hasn't run yet
            if (u) {
                setAdminLoading(true);
            } else {
                setAdminLoading(false);
            }
            setUser(u || null);
            setAuthLoading(false);
        });
        return () => {
            unsub();
            window.removeEventListener("focus", resetTouch);
        };
    }, [auth]);

    // Admin check — one authoritative read from the server.
    //
    // The previous version watched admins/{uid} with onSnapshot. Firestore answers a
    // listener from its local cache first, so a dead session produced an endless
    // cache-says-yes / server-says-no ping-pong: the panel appeared, the sidebar
    // attached listeners that were refused, the loader came back, and round again.
    //
    // getDocFromServer removes the ambiguity: it only resolves on a real server answer.
    // The rule "allow read: if request.auth.uid == uid" lets you read your own document
    // even when it does not exist, so the two outcomes are unambiguous:
    //   - resolves            -> snap.exists() is the definitive admin answer
    //   - permission-denied   -> the server sees no valid session, not a missing document
    useEffect(() => {
        if (!user?.uid) {
            setIsAdmin(false);
            setAdminError("");
            setAdminLoading(false);
            return;
        }

        let cancelled = false;
        setIsAdmin(false);
        setAdminError("");
        setAdminLoading(true);

        const isSessionError = (code) =>
            code === "permission-denied" ||
            code === "unauthenticated" ||
            String(code || "").startsWith("auth/");

        const readAdminDoc = async (forceRefreshToken) => {
            await user.getIdToken(forceRefreshToken);
            return getDocFromServer(doc(db, "admins", user.uid));
        };

        (async () => {
            try {
                let snap;
                try {
                    snap = await Promise.race([
                        readAdminDoc(false),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(Object.assign(new Error("timeout"), { code: "timeout" })), 15000)
                        ),
                    ]);
                } catch (err) {
                    if (!isSessionError(err?.code)) throw err;
                    // One retry with a freshly minted token, in case it had simply expired.
                    snap = await readAdminDoc(true);
                }

                if (cancelled || !mountedRef.current) return;
                setIsAdmin(snap.exists());
                setAdminError(snap.exists() ? "" : "This account is not registered as an administrator.");
                setAdminLoading(false);
            } catch (err) {
                if (cancelled || !mountedRef.current) return;
                console.error("Admin check failed:", err);
                setIsAdmin(false);
                setAdminLoading(false);

                if (isSessionError(err?.code)) {
                    // The token cannot be renewed: end the session instead of looping,
                    // so the login form comes back on its own.
                    setAdminError("Your session expired. Please sign in again.");
                    signOut(auth).catch(() => { });
                } else if (err?.code === "timeout") {
                    setAdminError("The admin check timed out. Check your connection and try again.");
                } else {
                    setAdminError(`Admin check failed: ${err?.code || "unknown error"}.`);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
        // Keyed on the uid on purpose: the user object identity changes on every token
        // refresh, which would re-run this check needlessly.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.uid, auth]);

    const login = async (e) => {
        e?.preventDefault?.();

        const cleanEmail = String(email || "").trim();
        const pass = String(password || "");

        if (!cleanEmail || !pass) {
            openInfoModal("Login Failed", "Please enter both email and password.");
            return;
        }
        if (!isValidEmail(cleanEmail)) {
            openInfoModal("Login Failed", "Please enter a valid email address.");
            return;
        }

        try {
            setLoggingIn(true);
            await signInWithEmailAndPassword(auth, cleanEmail, pass);
            setPassword("");
        } catch (err) {
            console.error(err);
            openInfoModal("Login error", mapAuthError(err?.code));
        } finally {
            setLoggingIn(false);
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
        } catch (err) {
            console.error(err);
            openInfoModal("Logout Error", "Could not logout safely.");
        }
    };

    const busy = authLoading || adminLoading;

    // A stuck session used to leave the page on a spinner with no way out.
    const [slowAuth, setSlowAuth] = useState(false);
    useEffect(() => {
        if (!busy) {
            setSlowAuth(false);
            return;
        }
        const t = setTimeout(() => setSlowAuth(true), 4000);
        return () => clearTimeout(t);
    }, [busy]);

    const renderContent = () => {
        const props = { onDirtyChange: (isDirty) => handleDirtyChange(activeTab, isDirty) };
        switch (activeTab) {
            case "stats":
                return <StatsAdmin {...props} />;
            case "newsletter":
                return <NewsletterAdmin {...props} />;
            case "verse":
                return <MonthlyVerseAdmin {...props} />;
            case "overrides":
                return (
                    <ProgramOverridesAdmin
                        {...props}
                        initialOverride={pendingOverride}
                        onConsumed={() => setPendingOverride(null)}
                    />
                );
            case "events":
                return <EventsAdmin {...props} onCreateOverride={navigateToOverride} />;
            case "churches":
                return <ChurchesAdmin {...props} />;
            case "suggestions":
                return <ChurchSuggestionsAdmin {...props} />;
            default:
                return <StatsAdmin {...props} />;
        }
    };

    const touchStartX = useRef(null);

    const handleTouchStart = (e) => {
        touchStartX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = (e) => {
        if (touchStartX.current === null) return;
        const touchEndX = e.changedTouches[0].clientX;
        const deltaX = touchEndX - touchStartX.current;

        if (!sidebarOpen) {
            // Open: Swipe right from the left edge (e.g. within 50px of the edge)
            if (touchStartX.current < 50 && deltaX > 70) {
                setSidebarOpen(true);
            }
        } else {
            // Close: Swipe left
            if (deltaX < -70) {
                setSidebarOpen(false);
            }
        }
        touchStartX.current = null;
    };

    return (
        <div className="adminPage">
            {busy ? (
                <div className="adminLoginWrap">
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
                        <div className="adminSpinner" />
                        {slowAuth && (
                            <button className="adminBtn" onClick={logout}>
                                Taking too long? Log out
                            </button>
                        )}
                    </div>
                </div>
            ) : !user ? (
                <div className="adminLoginWrap">
                    <div className="adminCard adminCard--login">
                        <h2 className="adminTitle">Login</h2>

                        <form className="adminForm" onSubmit={login}>
                            <label className="adminLabel">
                                Email
                                <input
                                    className="adminInput"
                                    type="email"
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value);
                                    }}
                                    autoComplete="email"
                                />
                            </label>

                            <label className="adminLabel">
                                Password
                                <input
                                    className="adminInput"
                                    type="password"
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                    }}
                                    autoComplete="current-password"
                                />
                            </label>

                            <button className="adminBtn" type="submit" disabled={loggingIn}>
                                {loggingIn ? "Logging in..." : "Login"}
                            </button>
                        </form>
                    </div>
                    <ConfirmModal
                        isOpen={modal.isOpen}
                        title={modal.title}
                        message={modal.message}
                        actions={modal.actions}
                        progress={modal.progress}
                        onConfirm={modal.onConfirm}
                        onCancel={() => setModal({ ...modal, isOpen: false })}
                    />
                </div>
            ) : !isAdmin ? (
                <div className="adminLoginWrap">
                    <div className="adminCard adminCard--center">
                        <h2 className="adminTitle">Access Denied</h2>
                        <div className="adminMuted">{adminError || "You do not have permission to access this section."}</div>
                        {user?.uid && (
                            <div className="adminMuted" style={{ marginTop: 10, fontSize: 12, wordBreak: "break-all" }}>
                                Signed in as {user.email} · UID {user.uid}
                            </div>
                        )}
                        <button className="adminBtn" onClick={logout} style={{ marginTop: 20 }}>
                            Logout
                        </button>
                    </div>
                </div>
            ) : (
                <div
                    className={`adminLayout ${sidebarOpen ? "sidebar-open" : ""}`}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                >
                    {/* Mobile Header / Hamburger */}
                    <div className="adminMobileHeader">
                        <button
                            className="adminHamburger"
                            onClick={() => setSidebarOpen(true)}
                            aria-label="Open menu"
                        >
                            <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                                <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                        </button>
                        <span className="adminMobileTitle">Bethel Admin</span>
                        <button
                            className="adminHamburger adminMobileLogout"
                            onClick={logout}
                            aria-label="Log out"
                            title="Log out"
                        >
                            <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                    </div>

                    {/* Sidebar Overlay */}
                    {sidebarOpen && (
                        <div
                            className="adminSidebarOverlay"
                            onClick={() => setSidebarOpen(false)}
                        />
                    )}

                    <div className="adminSidebarWrap">
                        <AdminSidebar
                            activeTab={activeTab}
                            onTabChange={handleTabChangeAttempt}
                            onLogout={logout}
                        />
                    </div>

                    <main className="adminContent">
                        {renderContent()}
                    </main>
                </div>
            )}
            <ConfirmModal
                isOpen={modal.isOpen}
                title={modal.title}
                message={modal.message}
                actions={modal.actions}
                progress={modal.progress}
                onConfirm={modal.onConfirm}
                onCancel={() => setModal({ ...modal, isOpen: false })}
            />
        </div>
    );
}
