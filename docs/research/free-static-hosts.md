# Which free static hosts fit the Site?

Research for issue #3. Checked against each host's official docs on 2026-10-29.

The Site is static files only (ADR-0001). Media Tools will likely use multi-threaded ffmpeg.wasm, which needs cross-origin isolation (`Cross-Origin-Opener-Policy: same-origin` plus `Cross-Origin-Embedder-Policy: require-corp` or `credentialless`). So the host must be able to set custom response headers, and it must serve a wasm file of about 30 MB.

## Short answer

**Cloudflare (Pages, or Workers static assets) is the best fit.** It sets headers through a `_headers` file, and static requests and bandwidth are free and unlimited, so the Site costs nothing however popular it gets. Deploys come straight from GitHub. One catch: **each file can be at most 25 MiB**, so a ~30 MB ffmpeg core has to be split, compressed below the cap, or loaded from somewhere else (see "The 25 MiB problem").

Netlify and Vercel both support custom headers, but their free tiers are metered. A Site that serves 30 MB downloads uses them up fast, and then it **goes offline** until the next cycle unless someone pays. GitHub Pages cannot set headers at all, so it needs a service-worker workaround.

## Comparison

| | Cloudflare Pages / Workers assets | Netlify Free | Vercel Hobby | GitHub Pages |
|---|---|---|---|---|
| Custom headers (COOP/COEP) | Yes, `_headers` file, up to 100 rules [1][2] | Yes, `_headers` or `netlify.toml` [6] | Yes, `headers` in `vercel.json` (each counts toward 2,048 routes) [10][11] | **No.** Workaround: `coi-serviceworker`, which reloads the page on first visit [15] |
| Bandwidth / requests (free) | Static requests "free and unlimited" [3][4] | 300 credits/month hard cap. 1 GB costs 20 credits, 10k requests cost 2 credits, a production deploy costs 15 credits [7][8] | 100 GB Fast Data Transfer, 1M CDN requests per month [9] | Soft limit of 100 GB/month [13] |
| Per-file size cap | **25 MiB** per asset [1][5] | No documented hard cap. Docs warn that files over 10 MB can stall drag-and-drop deploys [16] | No per-file cap found. CLI source upload limit is 100 MB in total on Hobby [11] | Git blocks files over 100 MiB and warns over 50 MiB [14]. Whole site at most 1 GB [13] |
| Site/file count | 20,000 files [1][5] | No limit per deploy, but at most 54,000 files per directory [16] | 15,000 source files per CLI deploy [11] | 1 GB site [13] |
| If it gets popular | Still $0 for static traffic [3][4] | **All of the team's projects pause** ("Site not available") until next cycle, or upgrade (Personal is $9/mo for 1,000 credits) [7][17] | Over the limit, you "wait until 30 days have passed" [9]. Pro is $20 per developer seat per month [9] | Soft limits. Heavy overuse may get rate-limited (HTTP 429) [13] |
| Custom domain + HTTPS | Yes, 100 custom domains per project [1] | Yes | Yes, 50 domains per project [9] | Yes, HTTPS on custom domains [18] |
| Deploy from GitHub | Yes, Git integration; 500 builds/month, 20 min timeout [1] | Yes. Each production deploy costs 15 credits [8] | Yes, 100 deployments/day [9] | Yes, natively. Soft limit of 10 builds/hour unless you deploy through Actions [13] |
| Terms vs. no-ads/no-tracking | No conflict found. Self-serve CDN terms limit serving "video" or "disproportionate" large files except through Paid Services such as the "Developer Platform" [12]. Pages/Workers count as Developer Platform, but the terms don't name them (see below) | No conflict found | Hobby is **non-commercial only**. Ads count as commercial; asking for donations does not [10]. Fine for a no-ads Site | Not for "online business" or commercial SaaS [13]. Fine for a free Site |

## Notes

### Cloudflare: Pages or Workers static assets
Both read the same `_headers` file [2][5], and both serve static requests free and without limit [3][4]. They share the 25 MiB per-file and 20,000-file limits [1][5]. Cloudflare's migration guide says "Workers has a distinctly broader set of features" but does not call Pages deprecated [5]. Either one works. Choose during the build ticket.

Large-file clause [12]: the self-serve terms let Cloudflare limit CDN use when it serves "video or a disproportionate percentage of pictures, audio files, or other large files" without its Paid Services, and give the "Developer Platform" as an example of such a service. A wasm binary served as a Pages/Workers static asset is a Developer Platform asset, not proxied origin content. Still, the terms don't name Pages explicitly, so treat this as a small open question, not a confirmed exemption.

### The 25 MiB problem (Cloudflare)
The ffmpeg multi-threaded core is about 30 MB, which is over Cloudflare's 25 MiB per-asset cap [1][5]. Options to settle when building Media Tools:
- serve a pre-compressed copy, or split it into chunks and reassemble it in the browser;
- use a slimmer custom ffmpeg build that contains only the codecs the Tools need (likely well under 25 MiB);
- load the core from a public npm CDN or from Cloudflare R2. Under COEP `require-corp`, a cross-origin file must come with CORS or `Cross-Origin-Resource-Policy` headers.

### Netlify and Vercel: what "popular" means
A visitor who loads a 30 MB core uses about 0.03 GB. On Netlify Free, 300 credits buy at most 15 GB, before any deploys (each costs 15 credits) [8]. That is roughly 500 media-Tool loads a month before **every** project on the team pauses [17]. Vercel Hobby's 100 GB allows roughly 3,300 loads [9]. Browser caching helps repeat visitors, but neither host suits a Site that should stay free and online however popular it gets.

### GitHub Pages
It has no way to set headers. `coi-serviceworker` adds COOP/COEP from a service worker, but it reloads the page on the first visit, cannot be loaded from a CDN, and needs HTTPS [15]. That extra moving part is easy to get wrong for non-technical visitors. GitHub Pages is a reasonable fallback, not a first choice.

## Sources
1. Cloudflare Pages limits: https://developers.cloudflare.com/pages/platform/limits/
2. Cloudflare Pages headers: https://developers.cloudflare.com/pages/configuration/headers/
3. Cloudflare Pages Functions pricing ("requests to static assets are free and unlimited"): https://developers.cloudflare.com/pages/functions/pricing/
4. Workers static assets billing: https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
5. Workers platform limits (static assets: 20,000 files, 25 MiB): https://developers.cloudflare.com/workers/platform/limits/ and migration guide: https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/
6. Netlify custom headers: https://docs.netlify.com/manage/routing/headers/
7. Netlify pricing: https://www.netlify.com/pricing/
8. Netlify credit-based plans: https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/
9. Vercel Hobby plan: https://vercel.com/docs/plans/hobby
10. Vercel fair use guidelines (commercial usage): https://vercel.com/docs/limits/fair-use-guidelines
11. Vercel limits: https://vercel.com/docs/limits and headers: https://vercel.com/docs/headers
12. Cloudflare service-specific terms (CDN): https://www.cloudflare.com/service-specific-terms-application-services/
13. GitHub Pages limits: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
14. GitHub large files: https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github
15. coi-serviceworker: https://github.com/gzuidhof/coi-serviceworker
16. Netlify deploy overview (file/dir limits): https://docs.netlify.com/deploy/deploy-overview/
17. Netlify paused projects: https://docs.netlify.com/manage/accounts-and-billing/billing/resume-paused-projects/
18. GitHub Pages HTTPS: https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https
