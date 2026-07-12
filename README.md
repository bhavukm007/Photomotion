# Frameflow

A browser-only photo sequence video maker built for the hiring task.

## What it does

- Accepts and orders 3–5 gallery images.
- Previews soft dissolves, cinematic slides, and a generated fixed soundtrack.
- Exports the complete animation as a WebM video file directly in the browser.
- Keeps selected images on the user’s device; nothing is uploaded to a server.

## Run locally

Open `index.html` in a modern browser, or serve the folder with any static-file server.

## Deploy

This repository is ready to deploy on **Vercel** as a static site:

1. Push this folder to a GitHub repository.
2. Sign in to Vercel and choose **Add New → Project**.
3. Import the repository. Vercel detects the static site; leave Build Command blank and set the output directory to `.`.
4. Click **Deploy**. Every later GitHub push will redeploy automatically.

Netlify or GitHub Pages will work as well, but Vercel is the simplest choice for this zero-backend implementation.

## Browser note

Chrome and Edge are recommended for exporting, because the MediaRecorder API exports WebM most reliably there. The task only requires an exportable video file; WebM is broadly shareable and does not require server-side video processing.
