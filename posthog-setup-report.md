<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the Bethel Dworp Next.js App Router project. PostHog (`posthog-js`) was already installed and initialized via `PostHogProvider` and `PostHogPageView` components, which were already wired into the root layout. The wizard added event capture calls across 6 files covering key user actions — newsletter conversions, donation intent, contact engagement, language selection, and church map interaction.

Environment variables (`NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST`) were confirmed and updated in `.env.local`.

## Events instrumented

| Event | Description | File |
|---|---|---|
| `newsletter_subscribed` | User successfully subscribed to the newsletter | `app/sections/NewsletterSection.jsx` |
| `newsletter_subscription_duplicate` | User attempted to subscribe but was already subscribed | `app/sections/NewsletterSection.jsx` |
| `newsletter_link_shared` | User shared the newsletter link via native share or clipboard | `app/sections/NewsletterSection.jsx` |
| `newsletter_unsubscribed` | User successfully unsubscribed from the newsletter | `app/[lang]/unsubscribe/page.jsx` |
| `newsletter_resubscribed` | User cancelled their unsubscription (re-subscribed) | `app/[lang]/unsubscribe/page.jsx` |
| `donation_iban_copied` | User copied the church IBAN to clipboard, indicating intent to donate | `app/sections/Donations.jsx` |
| `contact_form_opened` | User opened the contact widget modal | `app/components/ContactWidget.jsx` |
| `contact_message_sent` | User successfully submitted a contact message | `app/components/ContactWidget.jsx` |
| `language_changed` | User switched the interface language | `app/components/LanguageSwitcher.jsx` |
| `church_map_cta_clicked` | User clicked the CTA link to view the Romanian Pentecostal churches map | `app/sections/WorldMapSection.jsx` |
| `church_suggestion_submitted` | User submitted a suggestion for a new or edited church on the map | `app/[lang]/romanian-pentecostal-churches-map/ChurchMap.jsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics**: https://us.posthog.com/project/323146/dashboard/1495184
- **Newsletter Subscriptions Over Time**: https://us.posthog.com/project/323146/insights/KqbEq3Ib
- **Contact Form Conversion Funnel**: https://us.posthog.com/project/323146/insights/IUcfIQz3
- **Newsletter Churn — Unsubscribes vs Resubscribes**: https://us.posthog.com/project/323146/insights/z06Wqtg1
- **Donation Intent — IBAN Copies Over Time**: https://us.posthog.com/project/323146/insights/OP9UihVw
- **Church Map & Language Engagement**: https://us.posthog.com/project/323146/insights/8W07YSeD

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-nextjs-app-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
