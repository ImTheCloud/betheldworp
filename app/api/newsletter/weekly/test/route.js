import { NextResponse } from "next/server";
import { getAdminContext } from "../../../../lib/adminAuth";
import { buildNewsletter } from "../../../../lib/newsletter/build";
import { sendTest } from "../../../../lib/newsletter/sending";
import { isValidEmail } from "../../../../lib/validation";

export const maxDuration = 60;

// Un seul exemplaire, à l'adresse de l'admin connecté (ou NEWSLETTER_TEST_EMAIL).
// Aucun abonné ne le reçoit.
export async function POST(request) {
    const admin = await getAdminContext(request);
    if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const to = process.env.NEWSLETTER_TEST_EMAIL || admin.email;
    if (!isValidEmail(to)) return NextResponse.json({ error: "no_test_email" }, { status: 400 });

    const payload = await request.json().catch(() => ({}));
    try {
        const built = await buildNewsletter(payload);
        if (built.error) return NextResponse.json({ error: built.error }, { status: 400 });
        const result = await sendTest({ rendered: built.rendered, to });
        if (!result.ok) return NextResponse.json(result, { status: result.error === "sending_disabled" ? 403 : 502 });
        return NextResponse.json({ ...result, to });
    } catch (err) {
        console.error("weekly test failed:", err);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}
