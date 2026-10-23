// Reads CHANGELOG.md. It only understands the changelog's own simple format:
//   # Title
//   An intro paragraph.
//   ## Weekday, Month D, YYYY
//   *An optional theme line.*
//   - **Headline.** Plain sentences.

export interface ChangeItem {
  headline: string;
  text: string;
}

export interface ChangeDay {
  date: string;
  theme: string;
  items: ChangeItem[];
}

export interface Changelog {
  title: string;
  intro: string;
  days: ChangeDay[];
}

const BULLET = /^- \*\*(.+?)\*\*\s*(.*)$/;
const THEME = /^\*([^*].*?)\*$/;

export function parseChangelog(md: string): Changelog {
  const log: Changelog = { title: '', intro: '', days: [] };
  const intro: string[] = [];
  let day: ChangeDay | null = null;
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('## ')) {
      day = { date: line.slice(3).trim(), theme: '', items: [] };
      log.days.push(day);
    } else if (line.startsWith('# ')) {
      log.title = line.slice(2).trim();
    } else if (!day) {
      intro.push(line);
    } else if (BULLET.test(line)) {
      const [, headline, text] = line.match(BULLET)!;
      day.items.push({ headline: headline.trim(), text: text.trim() });
    } else if (THEME.test(line) && !day.theme && !day.items.length) {
      day.theme = line.match(THEME)![1].trim();
    } else if (day.items.length) {
      // a wrapped bullet: keep the extra line with the bullet above it
      const it = day.items[day.items.length - 1];
      it.text = `${it.text} ${line}`.trim();
    }
  }
  log.intro = intro.join(' ');
  return log;
}
