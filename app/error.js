"use client";

export default function Error({ reset }) {
    return (
        <div style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Une erreur est survenue</div>
            <button onClick={() => reset()}>Recharger</button>
        </div>
    );
}