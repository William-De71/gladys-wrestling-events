// -----------------------------------------------------------------------------
// The kind of a show, guessed from its name.
//
// TheSportsDB does not say whether a show is a weekly TV episode or a big
// event, but its names do:
//   - `weekly`  a numbered episode ("RAW #1743", "Dynamite #327",
//               "AAA on FOX #38", "HonorClub #148") or a weekly arena show of
//               lucha libre named after its weekday ("Martes De Glamour",
//               "Sabados De Coliseo");
//   - `tour`    a night of a tour ("Road To The New Beginning Day 3",
//               "New Year Wars Day 1", "Open The New Year Gate Tag 1");
//   - `special` everything else: premium live events, pay-per-views and
//               specials ("Crown Jewel", "Wrestle Kingdom 20 In Tokyo Dome",
//               "WrestleMania 42 Night 1").
// The keys are forever (configuration, widget settings, scene filters).
// -----------------------------------------------------------------------------

const KINDS = ['weekly', 'tour', 'special'];

const NUMBERED = /#\s?\d+/;
const WEEKDAYS =
  /^(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bados?|domingos?|super viernes|arena m[eé]xico)\b/i;
// "Night 1" stays special: the two nights of WrestleMania are not a tour.
const TOUR_NIGHT = /\b(day|tag|jour|d[ií]a)\s*\d+\b/i;

/**
 * @description Guess the kind of a show from its name.
 * @param {string} name - The name TheSportsDB gives.
 * @returns {'weekly'|'tour'|'special'} The kind.
 * @example
 * kindOf('RAW #1743'); // -> 'weekly'
 * kindOf('Road To The New Beginning Day 3'); // -> 'tour'
 * kindOf('Crown Jewel'); // -> 'special'
 */
function kindOf(name) {
  const value = String(name ?? '').trim();
  if (NUMBERED.test(value) || WEEKDAYS.test(value)) {
    return 'weekly';
  }
  if (TOUR_NIGHT.test(value)) {
    return 'tour';
  }
  return 'special';
}

export { KINDS, kindOf };
