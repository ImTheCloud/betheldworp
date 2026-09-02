import React from "react";
import { COUNTRY_CODES } from "./mapData";

// Le drapeau d'un pays, ou un cercle gris quand le pays n'est pas dans la
// table. Memoise : la liste des eglises en affiche un par ligne, et rien dans
// ce composant ne change entre deux rendus.
const FlagImage = React.memo(({ country, className = "" }) => {
    const code = COUNTRY_CODES[country];
    if (!code) return (
        <span 
            className={className} 
            style={{ 
                width: '18px', 
                height: '18px', 
                display: 'inline-flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                fontSize: '1rem',
                lineHeight: 1
            }}
        >
            🌍
        </span>
    );
    return (
        <img 
            src={`/images/flags/${code}.png`}
            // Un pays ajouté sans drapeau local ne doit pas laisser d'image cassée.
            onError={(e) => { e.currentTarget.style.display = "none"; }}
            alt={country} 
            className={`flag-img ${className}`}
            style={{ 
                width: '18px', 
                height: 'auto', 
                display: 'inline-block', 
                verticalAlign: 'middle', 
                borderRadius: '2px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
            }}
        />
    );
});
FlagImage.displayName = "FlagImage";

export default FlagImage;
