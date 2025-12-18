import "./WeeklyProgram.css";

const WeeklyProgram = [
    { day: "Luni", title: "Seară de Tineret și Adolescenți", times: ["20:00-21:30"] },
    { day: "Marți & Vineri", title: "Seară de rugăciune", times: ["20:00-21:30"] },
    { day: "Miercuri", title: "Repetiție cor Mixt", times: ["20:00-21:30"], flagged: true },
    { day: "Joi", title: "Repetiție cor Bărbătesc", times: ["20:00-21:30"], flagged: true },
    { day: "Sâmbăta", title: "Program cu copiii", times: ["11:00-13:30"] },
    { day: "Duminică", title: "Serviciu Divin", times: ["10:00-12:00", "18:00-20:00"], sunday: true },
];

function formatTimeToken(token, { drop00 }) {
    const t = String(token || "").trim();
    const m = t.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return t;
    const hh = String(Number(m[1]));
    const mm = m[2];
    if (drop00 && mm === "00") return `${hh}h`;
    return `${hh}h${mm}`;
}

function formatRange(range, opts) {
    const raw = String(range || "").trim().replace(/\s+/g, "");
    const parts = raw.split("-");
    if (parts.length !== 2) return range;
    const start = formatTimeToken(parts[0], opts);
    const end = formatTimeToken(parts[1], opts);
    return `${start}-${end}`;
}

export default function Program() {
    return (
        <section id="program" className="program-section">
            <div className="program-content">
                <div className="program-header">
                    <h2 className="program-title">Programul săptămânal</h2>
                </div>

                <div className="program-announcement" role="status" aria-live="polite">
                    <div className="program-attention" aria-hidden="true">
                        !
                    </div>

                    <div className="program-announcement-body">
                        <div className="program-announcement-title">Anunț (sărbători)</div>

                        <div className="program-announcement-row">
                            <div className="program-announcement-label">
                                Repetițiile <strong>cor mixt</strong> sunt <strong>anulate</strong> în:
                            </div>
                            <div className="program-announcement-dates">
                                <span className="program-pill">Miercuri 24/12/2025</span>
                                <span className="program-pill">Miercuri 31/12/2025</span>
                            </div>
                        </div>

                        <div className="program-announcement-sep" />

                        <div className="program-announcement-row">
                            <div className="program-announcement-label">
                                Repetițiile <strong>cor bărbătesc</strong> sunt <strong>anulate</strong> în:
                            </div>
                            <div className="program-announcement-dates">
                                <span className="program-pill">Joi 25/12/2025</span>
                                <span className="program-pill">Joi 01/01/2026</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="program-grid">
                    {WeeklyProgram.map((item, idx) => {
                        const drop00 = Boolean(item.sunday);
                        return (
                            <article key={`${item.day}-${idx}`} className={`program-card${item.sunday ? " is-sunday" : ""}`}>
                                {item.flagged ? (
                                    <div className="program-flag" aria-label="Atenție">
                                        <span aria-hidden="true">!</span>
                                    </div>
                                ) : null}

                                <div className="program-day">{item.day}</div>
                                <div className="program-activity">{item.title}</div>

                                <div className={`program-times${item.sunday ? " program-times--sunday" : ""}`}>
                                    {item.times.map((t) => (
                                        <span key={t} className="program-time">
                                            {formatRange(t, { drop00 })}
                                        </span>
                                    ))}
                                </div>
                            </article>
                        );
                    })}
                </div>

                <div className="program-verse-highlight">
                    <div className="program-verse-content">
                        <p className="program-verse-text">„Mă bucur când mi se zice: «Haidem la Casa Domnului!»"</p>
                        <p className="program-verse-ref">Psalmul 122:1</p>
                    </div>
                </div>
            </div>
        </section>
    );
}