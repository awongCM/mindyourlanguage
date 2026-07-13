# Mind Your Language v1 (Archived)

This folder contains the **original legacy application** (circa 2012–2014), preserved for reference. It is no longer maintained or deployed.

## What it was

A client-side web app titled **"Mandarin Phrase Translator Learner"** that helped users look up and translate Mandarin Chinese phrases using a local CEDICT dictionary file.

### Core features

- Bidirectional English ↔ Mandarin search via CC-CEDICT (`resource/cedict_1_0_ts_utf-8_mdbg.txt`)
- Simplified and Traditional character display with pinyin
- Chinese IME input plugin (`chinese-ime/`) for browser-based character entry
- Partial Google TTS integration (`google-tts-master/`) for pronunciation
- Results rendered with Underscore.js HTML templates

### Tech stack

| Layer | Technology |
|---|---|
| UI | jQuery 1.7, jQuery UI 1.8, Bootstrap 2.3 (customized in `myownbootstrap/`) |
| Icons | Font Awesome 4.1 |
| Templates | Underscore.js 1.3 |
| Data parsing | Space.js (`space-master/`) |
| Server | Node.js static file server (`server.js`, port 8000) |
| Dictionary | Client-side CC-CEDICT text file loaded over HTTP |

### Key files

| File | Purpose |
|---|---|
| `index.html` | Main application UI |
| `translation-api.js` | CEDICT lookup and abandoned REST API stubs (MyMemory, Baidu, Bing) |
| `utilities.js` | CEDICT line parsing into JSON elements |
| `server.js` | Local static file server |
| `resource/cedict_1_0_ts_utf-8_mdbg.txt` | CC-CEDICT dictionary data |

## Why it was archived

The v1 stack is a legacy jQuery/Bootstrap 2 codebase that is not suitable for modern development or deployment:

- Client-side parsing of a multi-megabyte dictionary file
- Exposed API keys in JavaScript source
- Hacked Google TTS requiring referrer workarounds
- No authentication, rate limiting, or structured API layer
- Dependencies (jQuery 1.7, Bootstrap 2) are end-of-life

The project intent — helping intermediate Mandarin learners ground their phrasing against fluent reference — is being rebuilt as **Mind Your Language v2**. See the root `README.md` and `docs/superpowers/specs/` for the modernization plan.

## Running locally (reference only)

If you need to inspect the original app:

```bash
cd archive/legacy-v1
node server.js
# Open http://localhost:8000/index.html
```

> **Note:** The CEDICT lookup in `translation-api.js` hardcodes `http://localhost:8000/resource/...`. The server must run from this directory on port 8000.

## Archived date

2026-07-13
