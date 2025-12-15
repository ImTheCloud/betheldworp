import "./About.css";

export default function About() {
    return (
        <section id="despre-noi" className="about-section">
            <div className="about-content">
                <div className="about-header">
                    <h2 className="about-title">Cine suntem?</h2>
                </div>

                <div className="about-text-block">
                    <div className="about-paragraphs">
                        <p className="about-paragraph">
                            Suntem creștini penticostali.
                        </p>
                        <p className="about-paragraph">
                            Credem în Trinitate, adică în Dumnezeu Tatăl, în Fiul și în Duhul Sfânt.
                        </p>
                        <p className="about-paragraph">
                            Credem că și azi Dumnezeu botează sufletul omului cu Darul Duhului Sfânt ca în ziua Cincizecimii.
                        </p>
                        <p className="about-paragraph">
                            Credem că Domnul Isus a venit să moară pe cruce pentru păcatele omenirii, ca prin jertfa Lui orice om să fie mântuit.
                        </p>
                    </div>
                </div>

                <div className="about-verse-highlight">
                    <div className="about-verse-content">
                        <div className="about-verse-label">Ioan 3:16</div>
                        <p className="about-verse-text">
                            „Fiindcă atât de mult a iubit Dumnezeu lumea, că a dat pe singurul Lui Fiu,
                            pentru ca oricine crede în El să nu piară, ci să aibă viaţa veşnică."
                        </p>
                        <p className="about-verse-ref">
                            Biblia, Noul Testament
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}