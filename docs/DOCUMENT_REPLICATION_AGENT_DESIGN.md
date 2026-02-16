# Document Replication Agent — Design & Implementation

## 1. AI Strategy: Custom Model vs Existing APIs

**Recommendation: Use existing APIs (OpenAI Vision / optional Google Document AI) for MVP; revisit custom models in Phase 3.**

| Factor | Custom model | Existing APIs (OpenAI / Document AI) |
|--------|--------------|--------------------------------------|
| **Time to market** | Months (data, training, tuning) | Weeks (integration + prompts) |
| **Accuracy** | Can exceed APIs on your doc types after tuning | 80–95% out of the box for variable detection |
| **Cost at 1k docs/mo** | Fixed infra + GPU; lower marginal cost at scale | ~$50–200/mo (Vision) or Document AI pricing |
| **Maintenance** | Retraining, versioning, deployment | Prompt/model updates only |
| **Stack fit** | New ML pipeline, Python services | Fits current Node + OpenAI stack |

**Conclusion:** Ship with **OpenAI Vision API** (or GPT-4o) for document image + text analysis and variable detection. You already use OpenAI on the server; add a single “document analyze” flow. Optionally add **Google Document AI** or **Azure Form Recognizer** later for higher accuracy on forms/invoices. Revisit a **custom document-understanding model** in Phase 3 if you have 10k+ labeled docs and need cost/control.

---

## 2. Document Parsing Libraries

| Task | Library | Notes |
|------|---------|--------|
| **PDF text extraction** | `pdf-parse` (Node) or `pdfjs-dist` | pdf-parse is simple; pdfjs-dist gives positions for overlay. |
| **PDF generation** | `pdf-lib` + `jspdf` | pdf-lib: fill forms / add text at coordinates; jspdf: build from scratch (current pipeline). |
| **DOCX read** | `mammoth` | Converts DOCX → HTML/text; good for extraction. |
| **DOCX write** | `docxtemplater` or `pizzip` + docx | For “fill template” DOCX output. |
| **OCR (images / scanned)** | `tesseract.js` (already in project) | Use client-side or server; good for Phase 2. |
| **Images** | `sharp` (Node) | Resize/convert for Vision API. |

**MVP combo:** **pdf-parse** (server) for PDF text, **mammoth** for DOCX text, **OpenAI Vision** for variable detection from first-page image + full text. **jspdf** for single-doc PDF output in Phase 1; add **pdf-lib** when you need to preserve layout (fill-in-place).

---

## 3. Architecture: Client-Side vs Server-Side AI

**Recommendation: Server-side analysis and generation.**

- **Analysis:** Run on server. Needs file access, OpenAI key security, and possibly large payloads (multi-page images). Keeps API keys and doc content off the client.
- **Generation:** Run on server for batch and for consistent formatting; optional client-side “preview” with jspdf in browser for instant feedback.
- **OCR:** Either server (Node + tesseract) or client (existing tesseract.js); server is simpler for one pipeline and no bundle bloat.

**Flow:** Client uploads file → Storage (or base64) → Server: extract text/images → call OpenAI → return detected fields. Client shows field mapper and data entry; on “Generate,” server produces PDF/DOCX and returns URL or blob.

---

## 4. Storage (Firebase)

- **Templates:** Firestore `documentTemplates/{templateId}`: metadata, `fields` (confirmed DetectedField[]), `storageUrl` (original file in Storage), `userId`, `createdAt`.
- **Generated files:** Firebase Storage `generated/{userId}/{templateId}/{generationId}.pdf` (or other format). Optional Firestore `generatedDocuments/{id}` for metadata and download URL.
- **Security:** Storage rules: user can read/write only under `templates/{userId}/`, `generated/{userId}/`. Firestore rules: same `userId` scope.
- **Lifecycle:** Optional TTL or cleanup job for old generated files (e.g. 30 days); keep templates until user deletes.

---

## 5. Edge Cases

| Case | Approach |
|------|----------|
| **Multi-page, different layouts** | Analyze per page; merge fields with `page` index; show per-page in viewer and allow per-page mapping. |
| **Complex tables (merged cells, nested)** | Use Vision/Form Recognizer for table structure; represent as repeating “row” field groups in mapping; Phase 2. |
| **Signatures / logos** | Store as “image” placeholders; replication keeps placeholder or user uploads replacement image; no OCR on signature. |
| **Embedded forms / interactive PDF** | Prefer PDF form field extraction (pdf-lib); map AcroForm fields to variables; fallback to Vision for non-form PDFs. |
| **Handwritten content** | OCR (tesseract or cloud OCR) + optional Vision for variable detection on OCR text. |

---

## Tech Stack Summary

- **Frontend:** React, TypeScript, existing UI; new components: DocumentUploader, DocumentViewer, FieldMapper, DataEntryForm, DocumentGenerator.
- **Backend:** Node (Express), Firebase Admin (Storage + Firestore), OpenAI (Vision + chat for variable detection).
- **Parsing:** pdf-parse, mammoth (DOCX); optional pdfjs-dist for coordinates.
- **Output:** jspdf (MVP), then pdf-lib for layout preservation; docxtemplater for DOCX in Phase 2.

---

## File Structure (Phase 1)

```
src/
  components/crewos/
    documentReplication/
      DocumentReplicationAgent.tsx   # Main container & flow
      DocumentUploader.tsx
      DocumentViewer.tsx
      FieldMapper.tsx
      DataEntryForm.tsx
      DocumentGenerator.tsx
      DocumentReplication.css
  services/
    documentReplication/
      types.ts
      api.ts                         # Calls /api/documents/*
      replicationPdf.ts              # Optional client preview

server/
  src/
    routes/
      documents.ts
    services/
      document-analyzer.ts           # Text extraction + OpenAI
      document-generator.ts          # PDF/DOCX generation
```

---

## Implementation Plan (Phased)

### Phase 1 (MVP)
1. Document upload (PDF, DOCX) → Firebase Storage; save template metadata in Firestore.
2. Server: extract text (pdf-parse, mammoth); optional first-page image for Vision; OpenAI prompt for variable detection (names, dates, amounts, etc.); return list of fields with suggested name, type, confidence, sample value.
3. Frontend: Document viewer (iframe/embed for PDF, or image); field list with accept/reject and manual add; simple data entry form; single-document generation; PDF output only; preview + download.

### Phase 2
- Image upload + OCR; repeating sections (tables); batch generation; DOCX/TXT/HTML output; better formatting preservation (pdf-lib overlay).

### Phase 3
- Custom model option; template library; cloud delivery; collaboration.

---

## Success Criteria (from spec)

- Upload PDF, DOCX (Phase 1); images in Phase 2.
- AI detects most variable fields; user can add/edit/remove.
- Generate documents with correct data; batch in Phase 2.
- Multiple output formats in Phase 2.
- Target &lt;10 s for typical doc in Phase 1; mobile-friendly UI.

This design keeps the door open for Document AI or a custom model later while shipping a working Replication Agent quickly on your current stack.
