import React from "react";
import FlagImage from "./FlagImage";
import { formatCasing } from "./mapHelpers";
import ChurchInfoLinks from "./ChurchInfoLinks";

// La liste des eglises, une ligne par eglise, et la ligne elle-meme.
//
// Les deux sont memoisees : la liste se redessine a chaque frappe dans la
// recherche, et sans cela chaque ligne serait reconstruite alors qu'aucune
// n'a change.
const ChurchListItem = React.memo(({ church, isSelected, selectChurch, isMobile, bottomSheetMode, setBottomSheetMode, userLocation, distanceMap, getCountryLabel, formatDistance, idx }) => (
    <button
        key={idx}
        className={`churchListItem ${isSelected ? "active" : ""}`}
        onClick={() => {
            selectChurch(church);
            if (isMobile && bottomSheetMode === "expanded") {
                setBottomSheetMode("collapsed");
            }
        }}
    >
        <div className="churchListItemIcon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>
        </div>
        <div className="churchListItemContent">
            <div className="churchListItemMain">
                <h3>{formatCasing(church.name)}{church.city ? ` ${formatCasing(church.city)}` : ''}</h3>
                {userLocation && distanceMap[church.id] && (
                    <span className="churchDistanceBadge">
                        {formatDistance(distanceMap[church.id])}
                    </span>
                )}
            </div>
            <p>{[(`${formatCasing(church.street) || ""} ${church.number || ""}`.trim()), (`${church.zipCode ? `${church.zipCode} ` : ""}${formatCasing(church.city) || ""}`.trim()), formatCasing(getCountryLabel(church.country))].filter(Boolean).join(", ")}</p>
        </div>
    </button>
));
ChurchListItem.displayName = "ChurchListItem";

const ChurchList = React.memo(({ 
    groupedChurches, 
    selectedChurch, 
    isExiting, 
    isMobile, 
    selectChurch, 
    bottomSheetMode, 
    setBottomSheetMode, 
    userLocation, 
    distanceMap, 
    getCountryLabel, 
    formatDistance, 
    t, 
    filteredChurches 
}) => {
    if (isMobile && (selectedChurch || isExiting)) {
        return (
            <div className={`mobileChurchDetails ${isExiting ? "exiting" : ""}`}>
                <div className="mobileDetailsBody">
                    <ChurchInfoLinks church={selectedChurch} t={t} />
                </div>
            </div>
        );
    }

    return (
        <>
            {Object.entries(groupedChurches).map(([country, items]) => (
                <div key={country} className="churchCountryGroup">
                    <h2 className="churchCountryHeader">
                        <FlagImage country={country} className="countryFlag" />
                        {formatCasing(t(`country_${country}`) === `country_${country}` ? country : t(`country_${country}`))}
                        <span className="countryCount">{items.length}</span>
                    </h2>
                    {items.map((church, idx) => (
                        <ChurchListItem 
                            key={church.id || idx}
                            church={church}
                            isSelected={selectedChurch?.id === church.id}
                            selectChurch={selectChurch}
                            isMobile={isMobile}
                            bottomSheetMode={bottomSheetMode}
                            setBottomSheetMode={setBottomSheetMode}
                            userLocation={userLocation}
                            distanceMap={distanceMap}
                            getCountryLabel={getCountryLabel}
                            formatDistance={formatDistance}
                            idx={idx}
                        />
                    ))}
                </div>
            ))}

            {filteredChurches.length === 0 && (
                <div className="churchListEmpty">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <p>{t("noChurchFound")}</p>
                </div>
            )}
        </>
    );
});
ChurchList.displayName = "ChurchList";

export { ChurchListItem, ChurchList };
