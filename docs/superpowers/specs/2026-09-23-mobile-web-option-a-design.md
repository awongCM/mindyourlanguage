# Mobile web — Option A (use on phone, data stays on device)

**Date:** 2026-09-23  
**Status:** Approved  
**Scope:** Layout, touch targets, safe areas, iOS TTS gesture prep — no PWA, sync, or offline.

## Goal

Use the deployed site on mobile Safari/Chrome for Translate and Practice without horizontal scroll, cramped taps, or duplicate chrome. Phrasebook, history, and review events remain in that browser’s `localStorage`.

## In scope

- Explicit viewport metadata
- Safe-area padding on sticky header and sheet content
- Compact page chrome on small screens (site header keeps product name; pages use short titles)
- Touch-friendly primary controls (translate, reveal, grades, shadowing, nav)
- Word breaking for long CJK/Latin lines
- `speechSynthesis.resume()` before speak (iOS user-gesture path)
- Manual test checklist in README

## Out of scope

- PWA manifest / installability
- Cloud sync / auth
- Offline drills
- STT / mic input
- Dedicated mobile navigation shell

## Success criteria

On a phone in portrait, without zooming:

1. Translate, read results, open grounding
2. Play TTS after tapping a play control
3. History / Phrasebook drawers scroll and restore
4. Practice: reveal → grade → reliability needle updates
5. Switch Translate ↔ Practice in ≤2 taps

## Manual test checklist

- iPhone Safari (primary) and one Android browser
- `/`: paste → translate → play audio → save → history restore
- `/practice`: due drill → reveal → grade → confirm needle text updates
- Rotate to landscape briefly — no broken horizontal scroll
