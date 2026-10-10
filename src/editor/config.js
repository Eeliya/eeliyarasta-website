/**
 * Visual editor settings. The editor only runs on the dev server (`npm run dev`).
 * Only existing JSON files in these folders of contentDir can ever be written (Save) or
 * committed (Publish): pages/, sources/ and settings/ (see src/site/files.js).
 */
import { FOLDERS } from '../site/files.js';

export default {
  owner: 'Eeliya',
  repo: 'eeliyarasta-website',
  contentDir: 'content',
  folders: FOLDERS,
};
