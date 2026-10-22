/**
 * The editor's tokens for CSS it injects into the preview (overlay.js's Shadow DOM, bridge.js's
 * <style>), where the editor's stylesheet doesn't reach. Read from the token files themselves
 * (styles/_tokens.scss: the editor's own, never the site's or its theme's), so they are the one
 * source: no copy here.
 */
import editor from './styles/_tokens.scss?raw';
import { uiTokens } from './lib/css-tokens.js';

export const T = uiTokens(editor);
