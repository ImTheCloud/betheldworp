// app/components/AboutSection.jsx
import "./AboutSection.css";

export default function AboutSection() {
    return (
        <section id="despre-noi" className="about-section">
            <div className="about-content">
                <h2 className="about-title">Cine suntem?</h2>

                <div className="about-lines">
                    <p className="about-line">
                        Suntem creștini penticostali.
                    </p>
                    <p className="about-line">
                        Credem în Trinitate, adică în Dumnezeu Tatăl, în Fiul și în Duhul Sfânt.
                    </p>
                    <p className="about-line">
                        Credem că și azi Dumnezeu botează sufletul omului cu Darul Duhului Sfânt ca în ziua Cincizecimii.
                    </p>
                    <p className="about-line">
                        Credem că Domnul Isus a venit să moară pe cruce pentru păcatele omenirii, ca prin jertfa Lui
                        orice om să fie mântuit.
                    </p>
                </div>

                <div className="about-verse-strip">
                    <p className="about-verse-text">
                        „Fiindcă atât de mult a iubit Dumnezeu lumea, că a dat pe singurul Lui Fiu,
                        pentru ca oricine crede în El să nu piară, ci să aibă viaţa veşnică.”
                    </p>
                    <p className="about-verse-ref">
                        (Ioan 3:16)
                    </p>
                </div>
            </div>
        </section>
    );
}