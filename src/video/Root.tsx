import React from 'react';
import { Composition } from 'remotion';
import { Film } from './Film';
import spec from '../../scripts/sample-spec.json';
import type { RenderSpec } from '@/lib/spec';

/**
 * Remotion Studio / CLI entry.
 *
 * The product renders in the browser and never touches this — it exists so the film can
 * be rendered headlessly and INSPECTED. Reasoning about how a video looks by reading the
 * components that produce it does not work; the only way to know is to render frames and
 * look at them.
 */

const sample = spec as unknown as RenderSpec;

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Film"
    component={Film}
    durationInFrames={sample.durationInFrames}
    fps={sample.fps}
    width={sample.width}
    height={sample.height}
    defaultProps={{ spec: sample }}
  />
);
