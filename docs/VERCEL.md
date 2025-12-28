Vercel environment variables for OpenLocalMap

Set these environment variables in the Vercel project settings (Environment Variables):

- TMB_APP_ID = 8029906b
- TMB_APP_KEY = 73b5ad24d1db9fa24988bf134a1523d1

Notes:
- The serverless proxy `api/tmb-buses.js` will use these env vars if set; otherwise it falls back to the embedded test keys.
- After setting env vars, trigger a redeploy in Vercel.

Quick test (after deploy):

- Fetch stop predictions for a stop id (example `108`):

```bash
curl -i "https://openlocalmap2.vercel.app/api/tmb-buses?stopId=108"
```

- Fetch nearby stops by coordinates:

```bash
curl -i "https://openlocalmap2.vercel.app/api/tmb-buses?lat=41.385&lon=2.173&radius=500"
```

If you see HTTP 500 from Vercel, check Deployments → Logs and paste the X-Vercel-Id and stack traces here for debugging.
