# REXROCK — Conversation Log

Local record of the build/iteration session for the REXROCK invoicing app.
Project location: `/home/gold/Desktop/projects/REXROCK/`

## 1. Initial build
Requested: a static HTML/Tailwind/JS app (no backend, no login, localStorage only) to create and print Facture, Devis, Bon de Commande, and Bon de Livraison documents.

Delivered:
- Navbar with 4 document-type tabs.
- Printable header: logo upload, "STE REXROCK" / "Machinery and spare parts".
- Client block: nom, adresse, ICE.
- Editable articles table: référence, désignation, qté, prix unit. HT, prix HT (auto-computed), add/remove rows.
- Totals: Total HT, remise (toggle show/hide, % or MAD), TVA (20%), Total TTC.
- Amount-in-French-words block, togglable between HT/TTC basis.
- Two signature boxes (société / client).
- Fixed footer with contact/legal info.
- Print button using `@media print` CSS to hide editor chrome.
- Logo stored as base64 in localStorage; all document data in localStorage.

Verified via headless Chrome (screenshot + print-to-PDF): math checked by hand (HT, remise, TVA, TTC, amount-in-words all correct).

## 2. Documents list + modal create/edit + JSON save/load
Requested: save documents to a local folder as JSON, load/edit/save them, show a table of documents per type, create/edit via modals, explicit Save button.

Delivered:
- Data model changed from single-draft-per-type to arrays of saved documents per type (with migration from the old format).
- Per-type document list table: N°, Date, Client, Total TTC, Modifier/Supprimer actions.
- "+ Créer" opens a blank document in a modal; "Modifier" opens an existing one.
- "Enregistrer" saves the draft into that type's list + localStorage.
- "Exporter JSON" saves to disk via the File System Access API (`showSaveFilePicker`) with a Blob-download fallback for unsupported browsers.
- "Charger un document (JSON)" imports a `.json` file back into the modal for review before saving.
- Dirty-state confirmation on modal close.

Verified end-to-end via a scripted headless-Chrome flow: create → save → list → edit → export JSON → re-verify print (single page, clean output).

## 3. Layout/behavior fixes round 1
Requested: hide Total TTC row when showing HT-only totals (and vice versa, words follow the same basis); remove "Client"/"Document" box titles; date format `dd/mm/yyyy`; fix modal being hidden under the navbar.

Delivered:
- "Afficher : Total HT / Total TTC" selector now also hides/shows the TVA + Total TTC rows and bolds Total HT as the final line when HT-only.
- Removed the "Document" and "Client" heading labels from their boxes.
- Date input switched from native `<input type="date">` to a text input with auto-slash formatting (`jj/mm/aaaa`), default value generated as `dd/mm/yyyy`.
- Modal z-index raised above the navbar's.

Verified via headless Chrome (fill + toggle HT/TTC + screenshot).

## 4. Styling round 2
Requested: bigger/better-colored footer with linked email, cachet (signature boxes) directly above the footer, all borders black.

Delivered:
- All document borders (boxes, tables, signature boxes, header divider) changed from light gray to black.
- Footer text enlarged, email styled as an orange underlined `mailto:` link.
- Signature boxes now pinned immediately above the footer via a flex `mt-auto` layout instead of floating mid-page with a gap.

## 5. Styling round 3 + print button in list + header title removed + bigger logo
Requested: push footer closer to true page bottom, taller signature boxes, fix amount-in-words title line-wrap, blacken remaining gray label text, remove logo border; (mid-turn) add a print button to the documents table; (mid-turn) remove the document-type title from the header; (mid-turn) increase logo size.

Delivered:
- Logo box border removed, size increased 96px → 144px.
- Signature boxes made taller (h-24 → h-36).
- Amount-in-words title shrunk to fit on one line (no more awkward mid-sentence wrap).
- Remaining gray labels (N°/Date/Nom/Adresse/ICE, Total HT/TVA row labels) turned black.
- Print-area `min-height` tuned to 271mm so the footer sits right at the physical page bottom margin, verified still single-page even with 7 line items (stress test).
- Added an "Imprimer" button to each row in the documents list — opens that document and triggers print directly.
- Removed the FACTURE/DEVIS/BON DE COMMANDE/BON DE LIVRAISON title from the printed header for all document types.

All changes in this session were verified with a scripted headless-Chrome harness (DevTools Protocol): filling forms, toggling options, saving/loading, and rendering both on-screen screenshots and print-to-PDF output, with page-count checks to guard against pagination overflow.

## 6. Print/A4 hardening round
Requested: taller item table closed up against the totals block, Référence column + toggle, DH currency suffixes, doc-type-specific number labels, fix borders/qté disappearing in real print PDFs (not just on-screen preview), fix cachet (signature boxes) getting hidden under the fixed footer, centered "Cachet & Signature" text.

Delivered:
- Rebuilt the item/totals tables with plain CSS (`table-layout: fixed`) instead of Tailwind utility classes — fixed a real Chromium bug where per-row `border-x` silently vanished past the first row in the paginated print/PDF pipeline (worked fine in emulated print, broke in real PDFs).
- Switched `qte-input`/`pu-input` from `type="number"` to `type="text" inputmode="numeric"` — Chromium's real print/PDF pipeline was silently failing to render `<input type="number">` values at narrow widths.
- Moved `#totalsSignatureBlock` to normal document flow directly under the table (out from under a `position:fixed`-to-page-bottom anchor) so a taller table closes the gap instead of leaving dead space; discovered and worked around a CSS `zoom` quirk (creates a new containing block for `position:fixed` descendants, same as `transform`) that broke the old anchor-to-page-bottom trick.
- Moved the footer-clearance reservation (`padding-bottom` sized from the footer's real height) onto `#totalsSignatureBlock` itself so signatures no longer render underneath the fixed footer.
- Added Référence column + `#refToggle` checkbox, N°/spec line, `DH` currency suffixes, dynamic doc-number label per type, bigger logo/company-name header block, centered "Cachet & Signature Société / Client" text.
- All fixes verified against real generated print PDFs (`page.pdf()` rasterized with `pdftoppm`), not just on-screen/emulated print screenshots, after repeatedly finding the two diverge in Chromium.

## 7. Mobile responsiveness
Requested: make the app usable on phones without touching the printed/A4 output.

Delivered:
- All changes scoped to `@media screen and (max-width: 640px)`, print output left byte-for-byte unaffected (re-verified via PDF diff).
- Navbar collapsed into a hamburger + dropdown menu on small screens.
- Doc-info/client grids, totals, and signature rows stack to one column; item table becomes horizontally scrollable instead of squishing.
- Modal action buttons reflowed into an even, tap-friendly row.
- Verified via Playwright screenshots at a 390×844 viewport.

## 8. Deployment: local service, GitHub, Windows machine, auto-pull
Requested: install/run the app persistently on this machine and on a second (HP/Windows) machine, keep them in sync automatically.

Delivered:
- Local systemd service (`rexrock.service`, `python3 -m http.server 8123`), enabled + auto-starts on boot.
- Pushed the project to a new public GitHub repo, `https://github.com/Dahbi-Dev/rexrock`.
- On the HP/Windows machine (`192.168.1.6`, reachable via SSH): installed Python + Git directly (winget was unreliable), `git clone`d the repo to `C:\Apps\REXROCK`, wrapped `python.exe -m http.server 8123` as a Windows service via NSSM (auto-start, auto-restart), opened the firewall port.
- Added a Windows Scheduled Task (`REXROCK-AutoPull`, runs as SYSTEM) that `git pull`s every 5 minutes indefinitely and logs each run to `C:\Apps\rexrock-pull.log` — keeps the HP machine in sync with GitHub with zero manual intervention. Confirmed reliable over multiple consecutive scheduled runs and a manual trigger.

## 9. Editable header & footer + CNSS number
Requested: add the company's CNSS number (7105793) to the printed footer; make the header (company name/tagline) and footer (contact/legal info) editable instead of hardcoded.

Delivered:
- Company name, tagline, and every footer field (email, address, capital, R.C., patente, ICE, and the new CNSS) are now `contenteditable` directly on the printed document — click and type, same interaction model as the other form fields.
- Stored as a single global `state.company` object in localStorage (like the logo — shared across all document types, not per-document), saved immediately on every edit.
- Print CSS already stripped the on-screen dashed-underline editing hint for `.print-input`-styled elements, so the printed/PDF output is unaffected by the change; verified via a rendered print PDF.
- Pushed to GitHub and confirmed the HP machine's auto-pull task picked up the change and is serving the updated files.

## Files
- `index.html` — structure, navbar, document list, modal/editor markup, templates.
- `app.js` — state, French number-to-words converter, totals math, list/modal rendering, JSON export/import, event wiring.
- `style.css` — nav/input styling, print media rules, modal print overrides.
