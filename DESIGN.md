# sizzle — design system

**Seed:** A repo's commit log is already a script. This cuts the trailer.

**Subject:** the molten gold letterform. One nameable object — a letter of SIZZLE, made of
liquid metal, that you could draw from memory after closing the tab. It opens the site,
anchors the scene, and reappears quieter on every other page.

**Category: Typography.** Because the product turns *text* — commit subjects, source lines —
into a film. The site has no product photography and no 3D scene; type is the only material
it has, so type must be the system rather than a layer on top of one.

### Required elements (binding, from the category)
- Typography IS the visual system, not decoration
- Extreme size/weight contrast between headline and body
- Text breaking into fragments or stacked units
- Type-driven layout hierarchy
- Kinetic type: at least one headline that moves
- **No reliance on gradients or colour to carry meaning**

### Fail tells (banned, from the category)
- Decorative effects: drop shadows, gradients on text
- Typography competing with imagery instead of anchoring it
- Timid type sizes — this category demands viewport-filling words

**Signature Move: object pierces layout.** The wordmark is not contained by the hero. Its
letters overrun the viewport edges, and the scene below is entered *through* the mark rather
than after it.

**First frame:** total black. Six gold letters, oversized to the point that the outer two are
cropped by the frame. One mono line, 12px, in the corner. Nothing else — no nav bar visible,
no button, no subhead.

---

## Tokens

```css
--ink:    #0a0c0a;   /* ground */
--ink-2:  #101310;   /* raised ground, used sparingly */
--bone:   #ecefe6;   /* figure */
--gold:   #f0a91c;   /* THE hue. flat fill only, never a ramp */

--ground: var(--ink);    /* role tokens: a scene overrides these three and */
--figure: var(--bone);   /* everything inside recolours without knowing     */
--accent: var(--gold);   /* which ground it is sitting on                   */

--ease:  cubic-bezier(0.16, 1, 0.3, 1);
--charge: 90ms cubic-bezier(0.2, 0, 0.1, 1);
--rule:  2px;
```

**Type pair**
- Display — **Bricolage Grotesque**. Variable optical size, genuinely irregular. Chosen
  against Archivo/Inter/Poppins/Space Grotesk, which are the AI-default grotesk set.
- Script — **Geist Mono**. Every label, number, index marker and piece of chrome.

**Type law:** every display block is paired with a tiny mono uppercase label. Sections carry
index markers (01/02/03). The small type is what makes the big type feel big — unpaired
display type reads as a slide.

**Scale:** display starts at `clamp(3rem, 11vw, 11rem)` and the hero mark is larger still.
Body sits at 15px. There is deliberately nothing in between; the gap IS the contrast.

---

## The five bans

1. **No gradients.** Not on text, not on grounds, not on cards, not as a wash. Flat fills and
   2px rules only. (This was the first thing rejected in review.)
2. **No AI-default grotesks** — Archivo, Inter, Poppins, Manrope, Space Grotesk, Sora.
3. **No wide letter-spacing on display type.** Tracking is tight or normal, never airy.
4. **No rounded panels floating on a background.** Structure comes from rules and space.
5. **No timid type.** If a display line does not overrun or nearly fill its measure, it is
   set too small.

## Floors

Grain permitted only as flat noise, never as a gradient. Hover states on everything
interactive. Visible focus rings. `prefers-reduced-motion` respected on every animation.
No horizontal overflow at 375px. AA contrast on all text. Transform and opacity only for
animation. One `<h1>` per page. Real heading hierarchy. No em dashes in UI copy.
