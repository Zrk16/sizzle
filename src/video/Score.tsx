import React from 'react';
import { Audio, Sequence, staticFile } from 'remotion';
import type { RenderSpec } from '@/lib/spec';

/**
 * The score: real recordings, not synthesis.
 *
 * Three synthesised versions were built before this one and every one of them sounded
 * synthetic, because it was. V1 read as "a whistle, then a plop". V2 was a rumble with
 * nothing above 300Hz. V3 matched the reference spectrum on paper and still read as
 * "static and pops" — which is the correct description of filtered noise, however well
 * its band energies line up with a real film's.
 *
 * That is the lesson: a spectrum match is not a sound. Measuring told me V2 was missing
 * its whole midrange, which was true and worth fixing, but no amount of band-balancing
 * turns noise into music. /brag and content-machine both bundle real audio for exactly
 * this reason, and content-machine's own notes say why — bundled rather than fetched
 * per-run, so it is deterministic and offline instead of gambling on a search result.
 *
 * Everything here is CC0 (Kenney UI/Interface/Impact packs, plus a music bed). Commercial
 * use and redistribution permitted, attribution not required; public/audio/CREDITS.md
 * records provenance anyway.
 *
 * Placement is still derived from the spec, which is the part that was always right: an
 * impact lands on every cut, so sound and picture cannot drift apart no matter how the
 * shot lengths fall out of the reading-time pacing.
 */

const BED = 'audio/bed.mp3';

/** Impacts alternate so a run of cuts has a rhythm rather than one repeated noise. */
const IMPACTS = [
  'audio/sfx/impactSoft_heavy_001.ogg',
  'audio/sfx/impactSoft_medium_000.ogg',
];

/** The bell is reserved for the final cut into the lockup — the one arrival that matters. */
const BELL = 'audio/sfx/impactBell_heavy_000.ogg';

/** A real UI click, for the pointer shot's button press. */
const CLICK = 'audio/sfx/click_003.ogg';

/** Frames after a pointer shot starts at which the button is actually pressed.
 *  Matches the `press` keyframes in the Pointer component, so the click is on contact. */
const PRESS_FRAME = 32;

export const Score: React.FC<{ spec: RenderSpec }> = ({ spec }) => {
  const lastIndex = spec.shots.length - 1;

  return (
    <>
      {/*
        Music bed. The source is normalised to -18 LUFS at build time and sits at -23.7
        dBFS median on its own, so it plays close to unity here: at 0.34 the finished mix
        measured -38.6 dBFS median against a reference range of -17 to -22, which is
        effectively silent. The bed was also originally cut from the track's first 32
        seconds, which is its quiet intro — this slice starts a minute in, where it is
        5dB fuller.
      */}
      <Audio src={staticFile(BED)} volume={0.95} />

      {spec.shots.map((shot, i) => {
        if (i === 0) return null; // nothing precedes the first shot, so there is no cut

        const isFinal = i === lastIndex;
        return (
          <Sequence key={`cut-${i}`} from={shot.startFrame} durationInFrames={45} layout="none">
            <Audio
              src={staticFile(isFinal ? BELL : IMPACTS[i % IMPACTS.length])}
              volume={isFinal ? 0.85 : 0.66}
            />
          </Sequence>
        );
      })}

      {/* A click on the frame the cursor actually presses the button. */}
      {spec.shots.map((shot, i) =>
        shot.kind === 'pointer' ? (
          <Sequence
            key={`click-${i}`}
            from={shot.startFrame + PRESS_FRAME}
            durationInFrames={20}
            layout="none"
          >
            <Audio src={staticFile(CLICK)} volume={0.9} />
          </Sequence>
        ) : null
      )}
    </>
  );
};
