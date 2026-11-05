# Birja·AI chat redesign: how to launch

This replaces the frontend with a redesigned chat-only app. It uses the same backend and API.

**It does not include `netlify/edge-functions/api-proxy.js`. Keep yours, or the site can't reach the backend.**

## Before you start

- This removes the Dashboard, Deals, Products, Companies, Brokers and search pages. Work on a branch, so the current site stays safe until you've checked this one.
- The hackathon's prototype can't be relied on to change after the deadline (5 November, 18:00). If that has passed, or the current link is already submitted, ask the team before deploying over it. Use a separate Netlify preview instead.

## Install

1. In your repo: `git checkout -b chat-redesign`
2. Delete your old `src/` folder.
3. Copy everything from this zip into the repo root, replacing files when asked.
4. Check that `netlify/edge-functions/api-proxy.js` is still there, and that `netlify.toml` still suits your setup.
5. Run:

   ```bash
   npm install
   npm run build
   ```

## Try it locally

Copy `.env.example` to `.env`, set `BACKEND_URL` and `UZEX_API_KEY`, then run:

```bash
npm run dev
```

Add `?mock` to the address to test the interface with canned answers. It spends no AI tokens and shows a DEMO badge.

## Deploy

Deploy a **preview** first:

```bash
netlify deploy --build
```

Check this list on the preview link:

- [ ] A real question gets an answer in Uzbek and in Russian
- [ ] The Manbalar (Sources) labels appear under the answer
- [ ] Clicking a label opens the side panel
- [ ] The "Reyestr yozuvlari" tab loads real records
- [ ] "Qanday hisoblandi?" opens and shows the steps and their results (no raw SQL)

If it all works, deploy to production:

```bash
netlify deploy --build --prod
```

Make sure `UZEX_API_KEY` is set in Netlify's environment variables as a secret. Never put the key in the frontend code.

## What changed in the frontend

- Chat-only page: light design, moving light ribbon, entrance animation
- Sources under every answer, with a side panel showing query results, registry records and a link to UZEX's files. It requests `include_trace: true` on every question.
- New calls from the panel, none of which use the AI: `GET /api/v1/deals`, `/participants`, `/brokers`, `/usd-rates`
- Automatic charts under answers, drawn from the query rows with no extra AI calls and no chart library. Comparisons get several lines or grouped bars. A chart only appears if its values also appear in the answer's text (`src/chartData.js`).
- Rotating example questions: press Tab to use one
- Staged thinking text, and answers that write themselves in. This is a visual effect: the backend doesn't stream.
- **Answer rules sent with every question (`ANSWER_RULES` in `src/api.js`):** in a test of 16 questions they cut AI steps by 41% and total time by 30%, and stopped extra figures on no-data questions. Move them into the backend's prompt when you can, then remove them here, and set `MAX_QUESTION_LENGTH` back to 2000. The rules also tell the AI that the app draws the charts, which stops it drawing them in text with emoji, so keep that part when you move them.
- Test tools: `?mock` for canned answers, `?tune` for ribbon settings. Neither loads for normal visitors.

## Recommended backend fixes (not in this zip)

These affect the score more than the frontend does.

1. **No-data questions and language:** `ANSWER_RULES` covers these from the frontend, but one test run isn't proof, and the backend's prompt is the right home for them. Without the rules, the agent added other years' figures on no-data questions, and the hackathon eliminates teams for naming a number or product where the data has no answer. Russian questions naming a company sometimes got Uzbek answers.
2. **Streaming:** the API has no streaming today. Real streaming would make text appear sooner than the current effect.
3. **Number check:** compare every number in an answer with the query results before sending. One test answer had a miscopied so'm total.
4. **Formulas:** write them in plain words. Raw `$\sum ...$` shows in answers.
5. **Keep Render awake** from before 18:00 through the checking, so the first request isn't slow.
