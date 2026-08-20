import React from 'react';
import { AbsoluteFill, Audio, Sequence } from 'remotion';
import type { RenderSpec } from '@/lib/spec';
import { ShotFrame } from './shots';
import { LOGICAL_HEIGHT } from './theme';
import { buildScore } from './audio';

/**
 * Assembles a RenderSpec into the finished film.
 *
 * Two structural decisions, both learned the expensive way:
 *
 * 1. CUTS, NOT WIPES. Shots are butt-joined with no overlap, so a wipe has nothing
 *    underneath to reveal — it sweeps the incoming ground across BLACK. Measured at one
 *    wipe boundary, mean frame luminance went 26.8 -> 88.1 -> 200.7 -> 222.3 across three
 *    frames while every real cut completed in one, and the result reads as the video
 *    stuttering and recovering. Counting delta spikes in a +/-4 frame window around each
 *    boundary, a clean cut is exactly ONE spike; the wipes showed THREE.
 *
 * 2. EVERYTHING SCALES FROM ONE LOGICAL CANVAS. Components are authored against a
 *    1080-tall canvas and the whole film is scaled to the real frame, so a single set of
 *    pixel values works at 16:9, 9:16 and 1:1. Sizing off the real frame instead made all
 *    type render about a third of its intended size the first time a different aspect
 *    ratio was tried.
 */
export const Film: React.FC<{ spec: RenderSpec }> = ({ spec }) => {
  const scale = spec.height / LOGICAL_HEIGHT;
  const logicalWidth = spec.width / scale;

  /**
   * The score is generated FROM this spec, so its hits sit exactly on the shot boundaries.
   * Derived at render time rather than fetched: every film has different cut points, so
   * there is no fixed track that could line up with all of them.
   */
  const score = React.useMemo(() => buildScore(spec), [spec]);

  return (
    <AbsoluteFill style={{ background: '#0A0A0C', overflow: 'hidden' }}>
      <Audio src={score.dataUri} />
      <div
        style={{
          position: 'absolute',
          width: logicalWidth,
          height: LOGICAL_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {spec.shots.map((shot, i) => (
          <Sequence
            key={i}
            from={shot.startFrame}
            durationInFrames={shot.durationInFrames}
            layout="none"
          >
            <ShotFrame
              shot={shot}
              accent={spec.accent}
              index={i}
              total={spec.shots.length}
              repo={spec.repo ?? ''}
              frameWidth={logicalWidth}
            />
          </Sequence>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** Remotion needs a component that takes plain props it can serialise. */
export const FilmComposition: React.FC<{ spec: RenderSpec }> = ({ spec }) => <Film spec={spec} />;
