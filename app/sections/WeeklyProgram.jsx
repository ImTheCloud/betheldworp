import "./WeeklyProgram.css";

const WeeklyProgram = [
    {
        day: "Luni",
        title: "Seară de Adolescenți și de Tineret",
        times: ["20:00 - 21:30"],
    },
    {
        day: "Marți & Vineri",
        title: "Seară de rugăciune",
        times: ["20:00 - 21:30"],
    },
    {
        day: "Miercuri",
        title: "Repetiție cor Mixt",
        times: ["20:00 - 21:30"],
    },
    {
        day: "Joi",
        title: "Repetiție cor Bărbătesc",
        times: ["20:00 - 21:30"],
    },
    {
        day: "Sâmbăta",
        title: "Program cu copiii",
        times: ["11:00 - 14:00"],
    },
    {
        day: "Duminică",
        title: "Serviciu Divin",
        times: ["10:00 - 12:00", "18:00 - 20:00"],
    },
];

export default function Program() {
    return (
        <section id="program" className="program-section">
            <div className="program-content">
                <h2 className="program-title">Programul săptămânal</h2>

                <div className="program-lines">
                    {WeeklyProgram.map((item, idx) => (
                        <article key={`${item.day}-${idx}`} className="program-row">
                            <div className="program-day">{item.day}</div>

                            <div className="program-main">
                                <div className="program-activity">{item.title}</div>

                                <div className="program-times">
                                    {item.times.map((t) => (
                                        <span key={t} className="program-time">
                      {t}
                    </span>
                                    ))}
                                </div>
                            </div>
                        </article>
                    ))}
                </div>

                <div className="program-highlight">
                    <p className="program-highlight-text">
                        „Mă bucur când mi se zice: «Haidem la Casa Domnului!»”
                    </p>
                    <p className="program-highlight-sub">
                        (Psalmul 122:1)
                    </p>
                </div>
            </div>
        </section>
    );
}