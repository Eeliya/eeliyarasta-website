/**
 * The editor's tokens for CSS it injects into the preview (overlay.js's Shadow DOM, bridge.js's
 * <style>), where the editor's stylesheet doesn't reach. Read from the token files themselves
 * (styles/_tokens.scss over the site's src/client/styles/_tokens.scss), so they are the one
 * source: no copy here.
 */
import site from '../client/styles/_tokens.scss?raw';
import editor from './styles/_tokens.scss?raw';
import { uiTokens } from './lib/css-tokens.js';

export const T = uiTokens(site, editor);
