# sizzle

Paste a GitHub repo. Get a short launch video built from your real commits and real code — directed by an AI, rendered in your browser.

A README does not sell your work. This does.

## How it works

```
repo URL
  ↓  GitHub REST API          commits, languages by bytes, contributors, a real source file
  ↓  AI director              picks shot kinds, tone order, and copy — then repairs itself
  ↓  zod                      validates; failures go back to the model as a correction turn
  ↓  @remotion/web-renderer   renders in YOUR browser. no server, no queue, no cost
MP4
```

### The AI is the director, not a copywriter

The model chooses which shots the film is made of, what ground each stands on, and what
goes on screen. It does not choose timing, camera travel, or easing — those come from
constants measured against reference ads. A model having an off day can write a weak line;
it cannot break the motion.

When the output fails validation, the errors are fed back to the model as a correction
turn rather than discarded. Free-form prompting for JSON measured 0/3 valid across four
models. Schema-enforced output plus the repair loop measures 3/3.

### Your code and commits are never paraphrased

`code` and `commitwall` shots take no model-written text at all. The real source lines and
the real commit subjects are injected at render time. The one unfakeable thing on screen
stays true.

### Rendering is free because it isn't ours

The video renders client-side via WebCodecs. That is what makes the effort slider
honest — a longer render costs you seconds on your own GPU and costs the service nothing.
It also means it scales to any number of visitors, because every visitor brings a GPU.

## Running it

```bash
pnpm install
cp .env.local.example .env.local   # then fill in the three keys
pnpm dev
```

| Variable | Why | Where |
| --- | --- | --- |
| `GITHUB_TOKEN` | Unauthenticated GitHub is 60 req/hr per IP. A **scopeless** classic token gives 5000. | [github.com/settings/tokens](https://github.com/settings/tokens) |
| `GEMINI_API_KEY` | The director. | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `OPENROUTER_API_KEY` | Optional fallback. | [openrouter.ai/keys](https://openrouter.ai/keys) |

Try the pipeline without the UI:

```bash
pnpm try darkroomengineering/lenis
```

## Notes from building it

- **The pixel grid is a floor on camera velocity.** Sub-pixel movement is not slow motion — the renderer quantises it into a 1px lurch every N frames, which reads as juddering. The camera runs linear with enough amplitude for ≥1px/frame.
- **Cuts, not wipes.** Shots are butt-joined, so a wipe has nothing underneath to reveal and sweeps the incoming ground across black. A clean cut produces exactly one luminance spike; a wipe produced three.
- **`z-index`, `backdrop-filter` and `mix-blend-mode` are silently dropped** by the browser renderer. Measured, not assumed. Layering is DOM order, back to front.
- **Tone is a rhythm device, not a theme.** Cutting ink → paper swings mean frame luminance by ~160 in one frame, which is what makes an edit read as an edit.

`spike/` is the throwaway harness that measured all of the above. Kept as evidence.

## Licence

MIT — see [LICENSE](LICENSE).

Builds on [victorylap](https://github.com/Zrk16), an earlier CLI of mine that rendered these
locally. This is the hosted rewrite: different renderer, different analyzer, different director.
