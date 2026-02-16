# Deploy & Test — CrewOS (Document Replication & Live Site)

## Why your changes weren’t showing

The live site at **https://gbeta-a7ea6.web.app** (or **gbeta-a7ea6.firebaseapp.com**) was last deployed **before** the Document Replication feature. The browser serves that old build until you deploy again.

---

## 1. Deploy to the live website (so you can use Gmail login and test there)

Run these from the **project root** (`Project-GBeta`), not from `server/`.

### One-time: install Firebase CLI and login (if needed)

```powershell
npm install -g firebase-tools
firebase login
```

### Build and deploy

```powershell
cd c:\Users\cherukurik\Project-Gbeta\Project-GBeta

# Build frontend (output goes to dist/)
npm run build

# Build backend (Cloud Functions)
cd server
npm run build
cd ..

# Deploy hosting + functions to Firebase
firebase deploy --only hosting,functions
```

When it finishes, it will print your **Hosting URL** (e.g. `https://gbeta-a7ea6.web.app`).

### Live URLs after deploy

- **Main app (login with Gmail):**  
  **https://gbeta-a7ea6.web.app**
- **Document AI (with Replicate tab):**  
  **https://gbeta-a7ea6.web.app/docai**
- **Document Replication directly:**  
  **https://gbeta-a7ea6.web.app/docai/replicate**

Use these to test the site and the feature we built.

---

## 2. Test locally (frontend + backend, no deploy)

Use this when you want to run and test on your machine without deploying.

### Terminal 1 — Backend (port 3001)

```powershell
cd c:\Users\cherukurik\Project-Gbeta\Project-GBeta\server
npm run dev
```

Leave this running. You should see: `Running on http://localhost:3001`.

### Terminal 2 — Frontend (Vite)

```powershell
cd c:\Users\cherukurik\Project-Gbeta\Project-GBeta
npm run dev
```

Use the URL Vite prints (e.g. **http://localhost:5173** or **http://localhost:5178**).

### What to test locally

1. Open the local URL (e.g. http://localhost:5173).
2. Go to **Document AI** → **Replicate** tab (or click **Replicate** in the header).
3. Upload a PDF or DOCX, map fields, enter data, generate PDF.

Document Replication uses the backend on port 3001; the frontend proxies `/api` to it.

---

## 3. Feature we built — quick checklist

- **Document Replication Agent**
  - **Upload:** PDF/DOCX, max 10MB → backend extracts text and suggests variable fields.
  - **Map fields:** Accept/reject AI suggestions, add fields, set types.
  - **Data entry:** Form built from confirmed fields.
  - **Generate:** New PDF (either “replicate” over original or simple field list).
- **Where it lives in the app**
  - **Document AI** → 4th tab **Replicate** (and header button **Replicate**).
  - **Agents** → Deploy **Document Replication Agent** → opening its card goes to **Document AI → Replicate**.

---

## 4. If deploy or build fails

- **`firebase: command not found`**  
  Install CLI: `npm install -g firebase-tools`, then run the deploy commands again.
- **Build errors**  
  From project root run `npm run build`; fix any TypeScript/errors it reports, then run the deploy steps again.
- **Backend 500 on upload**  
  On the live site, the backend is Firebase Cloud Functions. Set **OpenAI** (and any other) env in Firebase:  
  **Firebase Console → Project → Functions → Environment variables.**  
  For document replication, upload/analyze/generate run in the cloud after deploy.

After a successful `firebase deploy --only hosting,functions`, the **website link** to test and review the feature (with Gmail login) is:

**https://gbeta-a7ea6.web.app**

Use **/docai** for Document Intelligence and the **Replicate** tab for Document Replication.
