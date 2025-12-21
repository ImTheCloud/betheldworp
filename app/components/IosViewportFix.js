"use client";
// File for bug IOS zoom widget
import { useEffect } from "react";

function isIOS() {
    if (typeof navigator === "undefined") return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export default function IosViewportFix() {
    useEffect(() => {
        if (!isIOS()) return;

        const forceRelayout = () => {
            try {
                const meta = document.querySelector('meta[name="viewport"]');
                if (meta) meta.setAttribute("content", meta.getAttribute("content") || "");
            } catch {}
            try {
                const y = window.scrollY;
                window.scrollTo(window.scrollX, y);
            } catch {}
        };

        const onFocusOut = () => setTimeout(forceRelayout, 60);

        document.addEventListener("focusout", onFocusOut, true);

        const vv = window.visualViewport;
        let lastH = vv?.height;

        const onVVResize = () => {
            if (!vv) return;
            const h = vv.height;
            const grew = typeof lastH === "number" ? h > lastH + 40 : false;
            lastH = h;
            if (grew) setTimeout(forceRelayout, 60);
        };

        vv?.addEventListener("resize", onVVResize);

        return () => {
            document.removeEventListener("focusout", onFocusOut, true);
            vv?.removeEventListener("resize", onVVResize);
        };
    }, []);

    return null;
}