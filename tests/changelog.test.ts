// Checks that CHANGELOG.md follows its format, so the What's new screen never breaks.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseChangelog } from '../src/whatsnew/changelog';

const md = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const lines = md.split(/\r?\n/);

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "Thursday, October 22, 2026" -> a UTC date, or an error message. */
function readDate(s: string): Date | string {
  const m = s.match(/^([A-Z][a-z]+), ([A-Z][a-z]+) ([1-9]\d?), (\d{4})$/);
  if (!m) return `"${s}" is not written as "Weekday, Month D, YYYY"`;
  const [, wd, mon, d, y] = m;
  const month = MONTHS.indexOf(mon);
  if (month < 0) return `"${mon}" is not a month name in "${s}"`;
  const date = new Date(Date.UTC(+y, month, +d));
  if (date.getUTCMonth() !== month || date.getUTCDate() !== +d) return `"${s}" is not a real date`;
  if (WEEKDAYS[date.getUTCDay()] !== wd) return `"${s}" should be a ${WEEKDAYS[date.getUTCDay()]}`;
  return date;
}

describe('CHANGELOG.md', () => {
  const headings = lines.filter((l) => l.startsWith('## ')).map((l) => l.slice(3).trim());

  it('starts with a "# " title', () => {
    expect(lines.find((l) => l.trim())).toMatch(/^# \S/);
  });

  it('has real dates written as "Weekday, Month D, YYYY" with the right weekday', () => {
    for (const h of headings) expect(readDate(h), h).toBeInstanceOf(Date);
  });

  it('lists days newest first, with no repeats or out-of-order dates', () => {
    const times = headings.map((h) => readDate(h)).filter((d): d is Date => d instanceof Date).map((d) => d.getTime());
    for (let i = 1; i < times.length; i++) expect(times[i], `${headings[i]} must come after ${headings[i - 1]}`).toBeLessThan(times[i - 1]);
  });

  it('gives every day at least one bullet, each with a bold headline', () => {
    let day = '';
    const bullets = new Map<string, number>();
    for (const raw of lines) {
      const l = raw.trim();
      if (l.startsWith('## ')) bullets.set((day = l.slice(3).trim()), 0);
      else if (day && l.startsWith('- ')) {
        expect(l, `bullet under ${day} needs a bold headline: "- **Headline.** text"`).toMatch(/^- \*\*[^*]+\*\* \S/);
        bullets.set(day, bullets.get(day)! + 1);
      } else if (day && l) {
        expect(l, `unexpected line under ${day}`).toMatch(/^\*[^*].*\*$/);
      }
    }
    for (const [d, n] of bullets) expect(n, `${d} has no bullets`).toBeGreaterThan(0);
  });

  it('parses into the same days the file lists', () => {
    const log = parseChangelog(md);
    expect(log.title).not.toBe('');
    expect(log.days.map((d) => d.date)).toEqual(headings);
  });
});

describe('parseChangelog', () => {
  it('reads a sample day', () => {
    const log = parseChangelog(
      [
        '# What\'s new in Test Game',
        '',
        'The notable changes, newest first.',
        '',
        '## Wednesday, October 21, 2026',
        '',
        '*A big day.*',
        '',
        '- **New stage.** Fight on the Moon.',
        '- **Faster menus.** Menus open instantly. Enjoy!',
        '',
        '## Tuesday, October 20, 2026',
        '',
        '- **First release.** Hello.',
      ].join('\n'),
    );
    expect(log).toEqual({
      title: "What's new in Test Game",
      intro: 'The notable changes, newest first.',
      days: [
        {
          date: 'Wednesday, October 21, 2026',
          theme: 'A big day.',
          items: [
            { headline: 'New stage.', text: 'Fight on the Moon.' },
            { headline: 'Faster menus.', text: 'Menus open instantly. Enjoy!' },
          ],
        },
        { date: 'Tuesday, October 20, 2026', theme: '', items: [{ headline: 'First release.', text: 'Hello.' }] },
      ],
    });
  });
});
