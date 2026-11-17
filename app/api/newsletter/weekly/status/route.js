import { NextResponse } from "next/server";
import { getAdminContext } from "../../../../lib/adminAuth";
import { parseOptions } from "../../../../lib/newsletter/build";
import { computeRecipients, readIssue, sendingAllowed } from "../../../../lib/newsletter/sending";

// Où en est la newsletter d'une semaine : envois déjà faits, et qui la
// recevrait si on appuyait maintenant sur « Trimite ». Ne modifie rien.
export async function POST(request) {
    const admin = await getAdminContext(request);
    if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const payload = await request.json().catch(() => ({}));
    const parsed = parseOptions(payload);
    if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

    try {
        const [plan, issue] = await Promise.all([
            computeRecipients(parsed.weekKey, admin.token),
            readIssue(parsed.weekKey, admin.token),
        ]);
        return NextResponse.json({
            ok: true,
            weekKey: parsed.weekKey,
            recipients: plan.recipients.length,
            alreadyReceived: plan.alreadyReceived.length,
            siteActive: plan.siteActive,
            missingInBrevo: plan.missingInBrevo,
            blocked: plan.blocked,
            onlyInBrevo: plan.onlyInBrevo,
            sends: plan.sends,
            history: Array.isArray(issue?.history) ? issue.history : [],
            listName: "Newsletter Bethel Dworp",
            sendingAllowed: sendingAllowed(),
            testEmail: process.env.NEWSLETTER_TEST_EMAIL || admin.email || "",
        });
    } catch (err) {
        console.error("weekly status failed:", err);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}
