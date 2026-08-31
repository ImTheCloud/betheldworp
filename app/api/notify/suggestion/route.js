import { NextResponse } from "next/server";
import { notify, clean } from "../../../lib/notify";

// Notification d'une nouvelle suggestion d'église.
// L'appel passe par le serveur pour que le nom du canal ntfy reste secret.
export async function POST(request) {
    let payload;
    try {
        payload = await request.json();
    } catch {
        return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const name = clean(payload?.name);
    const city = clean(payload?.city, 60);
    const country = clean(payload?.country, 60);

    if (!name) {
        return NextResponse.json({ error: "missing_name" }, { status: 400 });
    }

    const notified = await notify({
        title: payload?.type === "edit" ? "Sugestie de modificare" : "Biserică nouă propusă",
        message: [name, city, country && `(${country})`].filter(Boolean).join(" "),
        priority: "high",
        tags: "church,pray",
    });

    // La suggestion est déjà enregistrée : une notification perdue ne doit pas
    // remonter au visiteur comme une erreur.
    return NextResponse.json({ ok: true, notified });
}
