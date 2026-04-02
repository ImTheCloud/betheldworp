"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import "./SearchableSelect.css";

/**
 * SearchableSelect - A premium autocomplete select component.
 */
export default function SearchableSelect({ 
    value, 
    onChange, 
    options = [], 
    placeholder = "Search...", 
    className = "",
    inputClassName = "adminInput",
    disabled = false
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const containerRef = useRef(null);
    const inputRef = useRef(null);

    const normalizedOptions = useMemo(() => {
        return options.map(opt => {
            if (typeof opt === "string") return { value: opt, label: opt };
            return opt;
        });
    }, [options]);

    const filteredOptions = useMemo(() => {
        const currentLabel = normalizedOptions.find(o => o.value === value)?.label || value || "";
        if (!searchTerm || searchTerm === currentLabel) {
            return normalizedOptions;
        }
        const term = searchTerm.toLowerCase();
        return normalizedOptions.filter(opt => 
            opt.label.toLowerCase().includes(term) || 
            opt.value.toLowerCase().includes(term)
        );
    }, [searchTerm, value, normalizedOptions]);

    // Sync search term with value label
    useEffect(() => {
        const currentLabel = normalizedOptions.find(o => o.value === value)?.label || value || "";
        setSearchTerm(currentLabel);
    }, [value, normalizedOptions]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
                const currentLabel = normalizedOptions.find(o => o.value === value)?.label || value || "";
                if (searchTerm === "" && value !== "") {
                    onChange("");
                } else {
                    setSearchTerm(currentLabel);
                }
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [value, searchTerm, onChange, normalizedOptions]);

    const handleSelect = (option) => {
        onChange(option.value);
        setSearchTerm(option.label);
        setIsOpen(false);
        setFocusedIndex(-1);
        inputRef.current?.blur();
    };

    const handleKeyDown = (e) => {
        if (disabled) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!isOpen) setIsOpen(true);
            setFocusedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setFocusedIndex(prev => (prev > 0 ? prev - 1 : prev));
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (focusedIndex >= 0 && focusedIndex < filteredOptions.length) {
                handleSelect(filteredOptions[focusedIndex]);
            } else if (filteredOptions.length === 1) {
                handleSelect(filteredOptions[0]);
            }
        } else if (e.key === "Escape") {
            setIsOpen(false);
            const currentLabel = normalizedOptions.find(o => o.value === value)?.label || value || "";
            setSearchTerm(currentLabel);
        }
    };

    return (
        <div className={`searchableSelect ${className}`} ref={containerRef}>
            <input
                ref={inputRef}
                type="text"
                className={`${inputClassName}`}
                value={searchTerm}
                placeholder={placeholder}
                onChange={(e) => {
                    setSearchTerm(e.target.value);
                    if (!isOpen) setIsOpen(true);
                    setFocusedIndex(0);
                }}
                onFocus={(e) => {
                    e.target.select();
                    setIsOpen(true);
                }}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                autoComplete="off"
            />
            
            {isOpen && !disabled && (
                <div className="searchableSelectDropdown">
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map((opt, idx) => (
                            <div
                                key={opt.value}
                                className={`searchableSelectItem ${
                                    opt.value === value ? "is-selected" : ""
                                } ${idx === focusedIndex ? "is-focused" : ""}`}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSelect(opt);
                                }}
                                onMouseEnter={() => setFocusedIndex(idx)}
                            >
                                {opt.label}
                                {opt.value === value && (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                        <path d="M20 6L9 17l-5-5" />
                                    </svg>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="searchableSelectEmpty">No results found</div>
                    )}
                </div>
            )}
        </div>
    );
}
