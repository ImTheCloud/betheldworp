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
import AdminSidebar from "./AdminSidebar";

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
    const [authError, setAuthError] = useState("");

    const [activeTab, setActiveTab] = useState("stats");
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            if (!mountedRef.current) return;
            setUser(u || null);
            setAuthLoading(false);
        });
        return () => unsub();
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
        setAuthError("");

        const cleanEmail = String(email || "").trim();
        const pass = String(password || "");

        if (!cleanEmail || !pass) {
            setAuthError("Please enter email and password.");
            return;
        }
        if (!isValidEmail(cleanEmail)) {
            setAuthError("Invalid email.");
            return;
        }

        try {
            setLoggingIn(true);
            await signInWithEmailAndPassword(auth, cleanEmail, pass);
            setPassword("");
        } catch (err) {
            console.error(err);
            setAuthError(mapAuthError(err?.code));
        } finally {
            setLoggingIn(false);
        }
    };

    const logout = async () => {
        setAuthError("");
        try {
            await signOut(auth);
        } catch (err) {
            console.error(err);
            setAuthError("Could not logout.");
        }
    };

    const busy = authLoading || adminLoading;

    const renderContent = () => {
        switch (activeTab) {
            case "stats":
                return <StatsAdmin />;
            case "newsletter":
                return <NewsletterAdmin />;
            case "verse":
                return <MonthlyVerseAdmin />;
            case "overrides":
                return <ProgramOverridesAdmin />;
            case "events":
                return <EventsAdmin />;
            default:
                return <StatsAdmin />;
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

        // If swiping right from the left edge (e.g. within 50px of the edge)
        if (!sidebarOpen && touchStartX.current < 50 && deltaX > 70) {
            setSidebarOpen(true);
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

                        {authError ? <div className="adminAlert">{authError}</div> : null}

                        <form className="adminForm" onSubmit={login}>
                            <label className="adminLabel">
                                Email
                                <input
                                    className="adminInput"
                                    type="email"
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value);
                                        if (authError) setAuthError("");
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
                                        if (authError) setAuthError("");
                                    }}
                                    autoComplete="current-password"
                                />
                            </label>

                            <button className="adminBtn" type="submit" disabled={loggingIn}>
                                {loggingIn ? "Logging in..." : "Login"}
                            </button>
                        </form>
                    </div>
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
                            onTabChange={(tab) => {
                                setActiveTab(tab);
                                setSidebarOpen(false);
                            }}
                            onLogout={logout}
                        />
                    </div>

                    <main className="adminContent">
                        {renderContent()}
                    </main>
                </div>
            )}
        </div>
    );
}