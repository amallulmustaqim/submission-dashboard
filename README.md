# DTRC Quick-Win Prototype — Split Version

This is a split, multi-page version suitable for GitHub Pages (static hosting).

## Structure

- `index.html` — Login
- `pm.html` — PM Dashboard + PM modals
- `submission.html` — DTRC submission form
- `secretariat.html` — Secretariat dashboard + detail & roles modals
- `css/styles.css` — Shared CSS
- `js/common.js` — Shared namespace, helpers, storage/auth, and common UI
- `js/login.js` — Login page logic
- `js/submission.js` — Submission page logic
- `js/pm.js` — PM page logic
- `js/secretariat.js` — Secretariat page logic

## Notes

- Uses `localStorage` for data (same as original prototype).
- Bootstrap 5 via CDN.
- Navigation is page-based. Each page checks auth; unauthorized users are redirected to `index.html`.
- Secretariat access is controlled by `localStorage` roles:
  - Seeded Admin: `amallul.latif@egnc.gov.bn` (role `edit`)
  - Add/remove roles from the Secretariat page (Admin only).
