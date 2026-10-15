# Structured document blocks by administrative document type

## Goal

Keep the main rich-text editor limited to the document body. Show each component outside the body as an independent, clearly labeled field or block, including multiple signature roles and every appendix. Provide a type-aware body outline for all 29 administrative document types without presenting suggested outlines as mandatory legal rules.

## Research conclusions

- The linked repository's `DOCUMENT-MODEL.md` separates semantic components such as national heading, issuing authority, number, place/date, type, subject, body, signer, and recipients. This is a useful data model.
- Its README says the legacy Nghị định 30 guides are awaiting audit/migration and are not yet the v2 engine's source of truth. Use the repository as a structural reference, not as the legal authority.
- Nghị định 30 Article 7 lists 29 administrative document types. Appendix III supplies sample layouts for 25 types; four types have no dedicated sample form.
- Appendix I allows body structure to vary by type and content, using suitable hierarchy (part/chapter/section/subsection/article/clause/point). Therefore the app must label type outlines as editable drafting suggestions.
- Existing data already stores header, number/date, document type, subject, body, signature title/name, recipients and appendices separately. The minutes template is an exception: it embeds a two-person signature table in `bodyHtml`, then also has generic signature fields, making signatures part of the main editor and duplicating signature controls.
- Official Gazette Appendix III Mẫu 1.9 keeps `Số: …/BB-…` in the left header column but has no location/issue-date line in the right column. It records meeting time, place, attendees, chair and secretary in the minutes content. The minutes UI/export must omit only the separate header-date field while keeping the number field.

## Implementation

1. Add a complete 29-type administrative catalog with abbreviations, body-outline group, and suggested structural sections. Test catalog coverage and distinguish suggestions from legal requirements.
2. Add structured signer blocks to document state. Convert the minutes template's secretary/chair signatures to two separate blocks and keep only meeting content in `bodyHtml`. For Mẫu 1.9, do not synthesize a location/issue-date line; preserve the reference number in its own header field.
3. Preserve imported multi-column signature tables as per-person blocks where rows can be identified; keep an explicit review status for uncertain mappings. Maintain legacy single-signer fields for old drafts/imports.
4. Render external document parts as individual cards/fields, with each signer and appendix separated. Render body in the sole main rich-text editor and show the selected type's suggested outline adjacent to it.
5. Update preview and DOCX export to render structured signer blocks outside the body. Ensure older drafts continue rendering and do not duplicate signatures.
6. Verify targeted unit tests, build, then inspect local UI and generated Word preview visually using a clean app session and the Biên bản case.

## Acceptance checks

- Catalog covers all 29 Nghị định 30 types; the four without a sample form are clearly identified as using an adaptable outline.
- The minutes body contains no signature table or signatory names; two signer roles and names are edited in their own blocks.
- The Mẫu 1.9 preview/export shows the reference number without a separate location/issue-date line; meeting date/time and location stay in the body.
- Header, number/date, type, subject, recipients, signatures and appendices remain outside the body editor.
- Preview and DOCX contain each external component once and preserve the body text.
- Legacy drafts without structured signers still render through the existing signer fields.
- Build/tests pass and the local result is inspected visually.
