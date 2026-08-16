import { Config } from '@remotion/cli/config';

/**
 * Headless render config — used only to inspect the film, never by the product.
 * The product renders client-side via @remotion/web-renderer.
 */
Config.setVideoImageFormat('jpeg');
Config.setConcurrency(6);
