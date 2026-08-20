import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import type { RenderSpec } from '@/lib/spec';
import { ShotFrame } from './shots';
import { LOGICAL_HEIGHT } from './theme';
import { CameraMotionBlur } from '@remotion/motion-blur';

/** Passthrough when disabled, so the tree shape is identical either way. */
const Blur: React.FC<{ enabled: boolean; children: React.ReactNode }> = ({ enabled, children }) =>
  enabled ? (
    <CameraMotionBlur shutterAngle={180} samples={6}>
      {children}
    </CameraMotionBlur>
  ) : (
    <>{children}</>
  );
import { Score } from './Score';

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
/**
 * `motionBlur` is OFF by default, and that is a constraint rather than a preference.
 *
 * CameraMotionBlur composites its time-shifted samples with `mixBlendMode: 'plus-lighter'`,
 * and @remotion/web-renderer drops mix-blend-mode silently — measured, not assumed. In the
 * browser the samples would stack at 1/N opacity with no additive blend, which is a ghosted
 * smear rather than blur. So the product, which renders client-side, cannot have it.
 *
 * Headless renders can, and it is worth ~8x the render time: 5m22s against 40s for the same
 * film. That matches the reference engine's own note calling it the biggest single quality
 * jump it ever made.
 */
export const Film: React.FC<{ spec: RenderSpec; motionBlur?: boolean }> = ({
  spec,
  motionBlur = false,
}) => {
  const scale = spec.height / LOGICAL_HEIGHT;
  const logicalWidth = spec.width / scale;


  return (
    <AbsoluteFill style={{ background: '#0A0A0C', overflow: 'hidden' }}>
      <Score spec={spec} />
      <div
        style={{
          position: 'absolute',
          width: logicalWidth,
          height: LOGICAL_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        <Blur enabled={motionBlur}>
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
        </Blur>
      </div>
    </AbsoluteFill>
  );
};

/** Remotion needs a component that takes plain props it can serialise. */
export const FilmComposition: React.FC<{ spec: RenderSpec }> = ({ spec }) => <Film spec={spec} />;
