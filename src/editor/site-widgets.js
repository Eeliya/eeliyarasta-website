/**
 * The site's own widgets (site.config.mjs widgets) in the editor's registry, before anything
 * reads it: main.js imports this first. Their definitions come from the dev server
 * (virtual:site-widgets, scripts/site-widgets.mjs); fields, defaults, labels and icons are all
 * the editor needs: the Add widget modal, the inspector, Motion and the toolbars read them.
 */
import defs from 'virtual:site-widgets';
import { registerWidgets } from '../site/widgets/index.js';

registerWidgets(defs);
