"use client";

import React from "react";

/**
 * A reusable, premium-styled confirmation modal.
 */
export default function ConfirmModal({
    isOpen,
    title = "Confirmation",
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    onConfirm,
    onCancel,
    variant = "danger", // 'danger' or 'primary'
    actions, // Optional array: [{ label, onClick, variant }]
    progress = null, // Number from 0-100 or null
    status = "" // Dynamically updated status message
}) {
    if (!isOpen) return null;

    return (
        <div className="adminModalOverlay" onClick={onCancel}>
            <div
                className="adminConfirmModal"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
            >
                <div className="adminModalHeader">
                    <h3 id="modal-title" className="adminModalTitle">{title}</h3>
                </div>

                <div className="adminModalBody">
                    <p className="adminModalMessage">{message}</p>
                    
                    {progress != null && !isNaN(progress) && (
                        <div className="adminModalProgress" style={{ minHeight: '45px', marginTop: '20px' }}>
                            <div className="adminProgressBarContainer" style={{ marginBottom: '10px' }}>
                                <div 
                                    className="adminProgressBarFill" 
                                    style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} 
                                />
                            </div>
                            <div className="adminProgressText" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#3b82f6', fontWeight: 600 }}>{status || "Traitement en cours..."}</span>
                                <span style={{ fontWeight: 800 }}>{Math.round(progress)}%</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="adminModalFooter">
                    {actions ? (
                        actions.map((action, i) => (
                            <button
                                key={i}
                                type="button"
                                className={`adminModalBtn ${
                                    action.variant === 'danger' ? 'adminModalBtn--danger' : 
                                    action.variant === 'accent' ? 'adminModalBtn--accent' :
                                    action.variant === 'secondary' ? 'adminModalBtn--secondary' :
                                    'adminModalBtn--primary'
                                }`}
                                onClick={action.onClick}
                            >
                                {action.label}
                            </button>
                        ))
                    ) : (
                        <>
                            <button
                                type="button"
                                className="adminModalBtn adminModalBtn--cancel"
                                onClick={onCancel}
                            >
                                {cancelText}
                            </button>
                            <button
                                type="button"
                                className={`adminModalBtn ${variant === 'danger' ? 'adminModalBtn--danger' : 'adminModalBtn--primary'}`}
                                onClick={onConfirm}
                            >
                                {confirmText}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
