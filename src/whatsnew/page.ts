// The standalone whats-new.html page: the same day cards as the in-game screen.
import { changelog } from './bundled';

const el = (tag: string, text = '', cls = '') => {
  const e = document.createElement(tag);
  if (text) e.textContent = text;
  if (cls) e.className = cls;
  return e;
};

document.getElementById('title')!.textContent = changelog.title || "What's new";
document.getElementById('intro')!.textContent = changelog.intro;
const days = document.getElementById('days')!;
for (const day of changelog.days) {
  const card = el('section', '', 'card');
  card.append(el('h2', day.date));
  if (day.theme) card.append(el('p', day.theme, 'theme'));
  const ul = el('ul');
  for (const it of day.items) {
    const li = el('li');
    li.append(el('strong', it.headline), ` ${it.text}`);
    ul.append(li);
  }
  card.append(ul);
  days.append(card);
}
