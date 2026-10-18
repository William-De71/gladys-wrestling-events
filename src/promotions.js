// -----------------------------------------------------------------------------
// The promotions the integration can follow.
//
// TheSportsDB files professional wrestling under the "Fighting" sport, one
// league per promotion. The keys below are ours and are forever (stored in
// the configuration, the widget settings, the scene filters and the calendar
// external ids); the league ids are TheSportsDB's (checked on 2026-10-18,
// every one with shows in 2026; NWA, PWG and MLW were left out, with no or
// a single show in 2026). The colors tint the calendars.
// -----------------------------------------------------------------------------

const PROMOTIONS = [
  {
    key: 'wwe',
    league: '4444',
    name: 'WWE',
    full: 'World Wrestling Entertainment',
    color: '#c8102e',
  },
  { key: 'aew', league: '4563', name: 'AEW', full: 'All Elite Wrestling', color: '#b8952e' },
  { key: 'njpw', league: '4449', name: 'NJPW', full: 'New Japan Pro-Wrestling', color: '#1d1d1b' },
  {
    key: 'tna',
    league: '4455',
    name: 'TNA',
    full: 'Total Nonstop Action Wrestling',
    color: '#2b59c3',
  },
  { key: 'aaa', league: '4593', name: 'AAA', full: 'Lucha Libre AAA Worldwide', color: '#e4002b' },
  { key: 'roh', league: '4448', name: 'ROH', full: 'Ring of Honor', color: '#7a1f2b' },
  {
    key: 'cmll',
    league: '4595',
    name: 'CMLL',
    full: 'Consejo Mundial de Lucha Libre',
    color: '#0057a8',
  },
  {
    key: 'stardom',
    league: '5293',
    name: 'Stardom',
    full: 'World Wonder Ring Stardom',
    color: '#d6338a',
  },
  { key: 'ajpw', league: '4594', name: 'AJPW', full: 'All Japan Pro Wrestling', color: '#e65c00' },
  { key: 'ddt', league: '5289', name: 'DDT', full: 'DDT Pro-Wrestling', color: '#6a3fb5' },
  {
    key: 'dragon_gate',
    league: '5288',
    name: 'Dragon Gate',
    full: 'Dragon Gate',
    color: '#d4a017',
  },
  { key: 'gcw', league: '4611', name: 'GCW', full: 'Game Changer Wrestling', color: '#3c3c3c' },
  {
    key: 'revpro',
    league: '5290',
    name: 'RevPro',
    full: 'Revolution Pro Wrestling',
    color: '#a31621',
  },
  { key: 'mlp', league: '5911', name: 'MLP', full: 'Maple Leaf Pro Wrestling', color: '#b3001b' },
];

const PROMOTION_KEYS = PROMOTIONS.map((promotion) => promotion.key);
const DEFAULT_PROMOTIONS = ['wwe', 'aew', 'njpw', 'tna', 'aaa'];

const BY_KEY = new Map(PROMOTIONS.map((promotion) => [promotion.key, promotion]));
const BY_LEAGUE = new Map(PROMOTIONS.map((promotion) => [promotion.league, promotion]));

/**
 * @param {string} key - One of our keys.
 * @returns {object|undefined} The promotion.
 */
function promotionOf(key) {
  return BY_KEY.get(key);
}

/**
 * @param {string} league - A league id of TheSportsDB.
 * @returns {object|undefined} The promotion.
 */
function promotionOfLeague(league) {
  return BY_LEAGUE.get(String(league));
}

export { PROMOTIONS, PROMOTION_KEYS, DEFAULT_PROMOTIONS, promotionOf, promotionOfLeague };
