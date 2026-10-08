/**
 * Where the editor reads and commits content. Change these if the repo moves.
 * Only files listed here can ever be written (dev endpoint and GitHub commits).
 */
export default {
  owner: 'Eeliya',
  repo: 'eeliyarasta-website',
  branch: 'main',
  contentDir: 'content',
  files: ['site.json', 'home.json', 'people.json', 'places.json', 'projects.json', 'animations.json'],
  // localStorage key for the GitHub token (this browser only; never committed or sent anywhere but api.github.com)
  tokenKey: 'eeliyarasta-editor:github-token',
};
