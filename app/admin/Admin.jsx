"use client";

import "./Admin.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
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

function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

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
        if (activeTab) {
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

    useEffect(() => {
        setIsAdmin(false);
        setAdminLoading(true);

        if (!user?.uid) {
            setAdminLoading(false);
            return;
        }

        const ref = doc(db, "admins", user.uid);
        const unsub = onSnapshot(
            ref,
            (snap) => {
                if (!mountedRef.current) return;
                setIsAdmin(snap.exists());
                setAdminLoading(false);
            },
            (err) => {
                console.error(err);
                if (!mountedRef.current) return;
                setIsAdmin(false);
                setAdminLoading(false);
            }
        );

        return () => unsub();
    }, [user]);

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
                    <div className="adminSpinner" />
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
                        <div className="adminMuted">You do not have permission to access this section.</div>
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