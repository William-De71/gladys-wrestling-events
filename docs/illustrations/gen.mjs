// Builds the widget contents of the illustrations with the integration's own
// code: node gen.mjs <repo> <out.json> (run by render.sh)
//
// Monday 19 October 2026, 20:00 in Paris, following WWE and NJPW. The shows
// are the real ones TheSportsDB answered that week (test/fixtures/: RAW #1743,
// NXT #860, Super Junior Tag League Day 2, Crown Jewel), read through the
// real normalizer and widget builders. The posters are made up (drawn here):
// the images of TheSportsDB are fan art of unknown license.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [repo, out] = process.argv.slice(2);
const load = (path) => import(pathToFileURL(`${repo}/${path}`).href);
const { buildUpcomingWidget, buildNextShowWidget } = await load('src/widgets.js');
const { normalizeShow, showImage } = await load('src/shows.js');
const { normalizeConfig } = await load('src/config.js');
const { LANGUAGES } = await load('src/i18n.js');
const manifest = JSON.parse(readFileSync(`${repo}/gladys-assistant-integration.json`, 'utf8'));
const fixture = (name) =>
  JSON.parse(readFileSync(`${repo}/test/fixtures/${name}.json`, 'utf8')).events ?? [];

const NOW = Date.parse('2026-10-19T18:00:00Z');
const TZ = 'Europe/Paris';
const TODAY = '2026-10-19';
const POSTER = (name) => `https://r2.thesportsdb.com/images/media/event/thumb/${name}.jpg`;

const [raw, nxt] = fixture('day-wwe-2026-10-20');
const [njpw] = fixture('day-njpw-2026-10-25');
const [crownJewel] = fixture('day-wwe-2026-11-07');
const shows = [
  { ...raw, strThumb: POSTER('illustrationraw') },
  nxt,
  { ...njpw, strThumb: POSTER('illustrationnjpw') },
  { ...crownJewel, strThumb: POSTER('illustrationcrown') },
].map(normalizeShow);

/**
 * @description A made-up poster: a gradient, a title, the word "illustration".
 * @param {string} title - Big text.
 * @param {string[]} colors - Two gradient colors.
 * @returns {string} A data URL of an SVG image.
 */
function poster(title, [from, to]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
  <rect width="800" height="450" fill="url(#g)"/>
  <g fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-width="10">
    <rect x="150" y="120" width="500" height="260" rx="8"/><rect x="190" y="150" width="420" height="200" rx="6"/>
  </g>
  <text x="400" y="250" text-anchor="middle" font-family="Impact, Arial Black, sans-serif" font-size="96" fill="#ffffff" letter-spacing="4">${title}</text>
  <text x="400" y="420" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" fill="#ffffff" fill-opacity="0.7" letter-spacing="6">ILLUSTRATION</text>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

const POSTERS = {
  illustrationraw: poster('RAW', ['#c8102e', '#1d1d1b']),
  illustrationnjpw: poster('NJPW', ['#1d1d1b', '#b8952e']),
  illustrationcrown: poster('CROWN', ['#3a1c71', '#d4a017']),
};
const images = {};
for (const show of shows) {
  for (const size of ['small', 'medium']) {
    const image = showImage(show, size);
    if (image) {
      images[image.key] = POSTERS[image.key.split('-')[1]];
    }
  }
}

const data = {
  shows,
  now: NOW,
  today: TODAY,
  timeZone: TZ,
  config: normalizeConfig({ promotions: ['wwe', 'njpw'] }),
  ready: true,
  fetchedAt: NOW - 7 * 60 * 1000,
};
const contents = {};
for (const language of LANGUAGES) {
  contents[language] = {
    upcoming: buildUpcomingWidget({ ...data, settings: { count: '5' } }),
    next_show: buildNextShowWidget({ ...data, settings: {} }),
  };
}

const cards = Object.fromEntries(
  manifest.widgets.map((widget) => [widget.key, { icon: widget.icon, label: widget.label }]),
);
writeFileSync(out, JSON.stringify({ contents, images, cards }));
