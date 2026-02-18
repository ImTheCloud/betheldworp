"use client";

import "./Admin.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { db } from "../lib/Firebase";
import Link from "next/link";

import MonthlyVerseAdmin from "./sections/MonthlyVerseAdmin";
import ProgramOverridesAdmin from "./sections/ProgramOverridesAdmin";
import EventsAdmin from "./sections/EventsAdmin";
import StatsAdmin from "./sections/StatsAdmin";
import NewsletterAdmin from "./sections/NewsletterAdmin";

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

function IconLogout(props) {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
            <path
                d="M10 7V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2v-1"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M14 12H3m0 0 3-3m-3 3 3 3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
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
    const markLetter = "B";

    return (
        <div className="adminPage">
            <div className="adminWrap">
                <header className="adminHeader">
                    <div className="adminMark" aria-hidden="true">
                        {markLetter}
                    </div>

                    <div className="adminHeaderCenter">
                        <div className="adminHeaderTitle">Bethel Admin</div>
                    </div>

                    <div className="adminHeaderRight">
                        <Link href="/" className="adminIconBtn" aria-label="Go to Website" title="Go to Website" target="_blank">
                            <IconExternal />
                        </Link>
                        {user && (
                            <button className="adminIconBtn" onClick={logout} aria-label="Logout" title="Logout">
                                <IconLogout />
                            </button>
                        )}
                    </div>
                </header>

                {busy ? (
                    <div className="adminCard adminCard--center">
                        <div className="adminSpinner" />
                    </div>
                ) : !user ? (
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
                ) : !isAdmin ? (
                    <div className="adminCard adminCard--center">
                        <h2 className="adminTitle">Access Denied</h2>
                        <div className="adminMuted">You do not have permission to access this section.</div>
                    </div>
                ) : (
                    <div className="adminStack">
                        <StatsAdmin />
                        <NewsletterAdmin />
                        <MonthlyVerseAdmin />
                        <ProgramOverridesAdmin />
                        <EventsAdmin />
                    </div>
                )}
            </div>
        </div>
    );
}