# Render Deploy Hook CI

## 2026-10-24 — Missing RENDER_DEPLOY_HOOK_URL secret

Refresh CEDICT workflow (`.github/workflows/refresh-cedict.yml`) failed at "Trigger Render deploy" with `RENDER_DEPLOY_HOOK_URL is not set`.

Root cause: GitHub repo secret was never added. At failure time, `gh secret list` showed only `DATABASE_URL`.

Fix: Copy Deploy Hook from Render Dashboard → web service `mindyourlanguage` → Settings → Deploy Hook, then:

```bash
gh secret set RENDER_DEPLOY_HOOK_URL -R awongCM/mindyourlanguage
```

Do not append a `ref` query param (disables Render auto-deploys). Workflow POSTs the hook monthly and via workflow_dispatch.

Render workspace available: Andy Wong's Workspace (`tea-cspsg1q3esus738fae4g` — confirm before MCP writes).
