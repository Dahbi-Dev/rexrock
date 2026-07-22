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

## Files
- `index.html` — structure, navbar, document list, modal/editor markup, templates.
- `app.js` — state, French number-to-words converter, totals math, list/modal rendering, JSON export/import, event wiring.
- `style.css` — nav/input styling, print media rules, modal print overrides.
