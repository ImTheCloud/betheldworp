"use client";

import React from "react";

// Isole une section de la page.
//
// Sans cela, une seule exception dans un composant remonte jusqu'à
// app/[lang]/error.jsx et remplace la page entière par un message d'erreur.
// Ce n'est pas une hypothèse : c'est arrivé en production, un identifiant non
// importé dans le globe a fait disparaître tout l'accueil alors que seule la
// carte du monde était en cause.
//
// La section fautive cesse d'être affichée, le reste du site continue de
// fonctionner. Rien ne prend sa place : sur le site d'une église, un encadré
// d'erreur inquiète davantage qu'un contenu absent, et le visiteur ne peut
// rien faire de cette information. L'erreur reste entière dans la console,
// avec le nom de la section et la pile des composants.
export default class SectionBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { enPanne: false };
    }

    static getDerivedStateFromError() {
        return { enPanne: true };
    }

    componentDidCatch(erreur, info) {
        console.error(
            `Section « ${this.props.nom || "sans nom"} » en échec :`,
            erreur,
            info?.componentStack
        );
    }

    render() {
        if (this.state.enPanne) return null;
        return this.props.children;
    }
}
