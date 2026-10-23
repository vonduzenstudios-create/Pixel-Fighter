// CHANGELOG.md is bundled into the game when it is built, so the screen always
// shows the same text as the file in the repo.
import md from '../../CHANGELOG.md?raw';
import { parseChangelog } from './changelog';

export const changelog = parseChangelog(md);
