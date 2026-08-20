# Bundled SFX library

Source: **[Kenney](https://kenney.nl/)** — UI Audio, Interface Sounds, Impact Sounds and
Digital Audio packs. All **CC0** (public domain): commercial use, editing and redistribution
are all permitted, attribution not required. Credited here as provenance, not obligation.

| folder | count | use |
|---|---|---|
| `ui/` | 48 | clicks, rollovers, switches |
| `interface/` | 20 | short clicks, drops, bongs — the tightest clicks are here |
| `keyboard/` | 32 | per-keystroke typing under `typeon` shots |
| `impact/` | 13 | soft impacts and bells for hard cuts and reveals |

Defaults used by `tools/score.mjs`:
- click  `interface/click_003.ogg` (0.01s, low HF risk)
- key    `keyboard/keypress-003.wav`

Bundled rather than fetched per-run, following the same pattern `/brag` uses: deterministic,
offline, and curated once instead of gambling on a search result every time.
