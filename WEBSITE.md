# Permanent website setup (one-time)

You asked for a normal website (no download). The app is ready for that.

## What the website does

- You open a link in your browser
- You choose two PDFs from your computer
- Overlay happens **in your browser**
- PDFs are **not uploaded** to a server by the app
- Original PDFs are **not replaced**
- Closing the tab clears the session

## Permanent GitHub website (recommended)

Because this GitHub repo is private, you need one quick settings step:

1. Open: https://github.com/dallisfranko/pdfcompare/settings/pages
2. Under **Build and deployment**, set Source to **GitHub Actions**
3. Run the workflow **Deploy web app to GitHub Pages** once (Actions tab), or push any change
4. Your permanent site will be roughly:

`https://dallisfranko.github.io/pdfcompare/`

Only people with access to the private repo (or as allowed by your GitHub plan) may be able to open it.

If you want **anyone with the link** to use it with no GitHub login, the repo/site needs to be public, or we host it on another free website host (Netlify/Cloudflare). Tell me if you want that.
