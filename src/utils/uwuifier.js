// A self-contained uwu-ifier. Mirrors the classic uwuifier library's
// three-stage pipeline (words -> exclamations -> spaces) but is
// reimplemented from scratch here so there are no external dependencies.

const LETTER_MAP = { l: 'w', r: 'w', L: 'W', R: 'W' };

// Whole-word substitutions, checked with word boundaries so we don't
// mangle substrings inside unrelated words.
const WORD_MAP = {
  love: 'wuv',
  you: 'uu',
  the: 'da',
  this: 'dis',
  little: 'wittle',
  cute: 'kawaii~',
  fuck: 'fwick',
  hello: 'hewwo',
  no: 'nu',
  what: 'wat',
  friend: 'fwiend',
  stupid: 'baka',
  cat: 'kitteh',
  dog: 'doggo',
  good: 'gud',
};

const FACES = ['OwO', 'UwU', '>w<', '^w^', '(・`ω´・)', ';;w;;', 'owo', 'uwu', '(*≧ω≦)', 'ヽ(≧Д≦)ノ', 'rawr'];

const ACTIONS = [
  '*blushes*',
  '*runs away*',
  '*hides*',
  '*sweats*',
  '*giggles*',
  '*looks away*',
  '*screams*',
  '*huggles tightly*',
  '*boops your nose*',
  '*twirls hair*',
];

const EXCLAMATIONS = ['!?', '?!!', '?!! owo', '?!!1!', '?!?1', '?!?!', '?!'];

const STUTTER_CHANCE = 0.15;

function isUri(word) {
  return /^https?:\/\//i.test(word);
}

// Mentions, channel refs, and custom/unicode emoji — left untouched so
// links, pings, and emotes don't get mangled.
function isProtected(word) {
  return (
    /^<@!?\d+>$/.test(word) ||
    /^<#\d+>$/.test(word) ||
    /^<@&\d+>$/.test(word) ||
    /^<a?:\w+:\d+>$/.test(word) ||
    /^:[\w+-]+:$/.test(word)
  );
}

class Uwuifier {
  constructor({ wordsModifier = 0.9, spacesModifier = 0.35, exclamationsModifier = 0.8 } = {}) {
    this.wordsModifier = wordsModifier;
    this.spacesModifier = spacesModifier;
    this.exclamationsModifier = exclamationsModifier;
  }

  uwuifyWords(sentence) {
    return sentence
      .split(' ')
      .map((word) => {
        if (!word || isUri(word) || isProtected(word)) return word;
        if (Math.random() > this.wordsModifier) return word;

        let result = word;
        for (const [from, to] of Object.entries(WORD_MAP)) {
          const regex = new RegExp(`\\b${from}\\b`, 'gi');
          result = result.replace(regex, (match) => (match[0] === match[0].toUpperCase() ? capitalize(to) : to));
        }

        result = result.replace(/[lLrR]/g, (char) => LETTER_MAP[char] || char);

        if (Math.random() < STUTTER_CHANCE && /^[a-zA-Z]/.test(result)) {
          result = `${result[0]}-${result}`;
        }

        return result;
      })
      .join(' ');
  }

  uwuifyExclamations(sentence) {
    return sentence.replace(/[!?]+/g, (match) => {
      if (Math.random() > this.exclamationsModifier) return match;
      return EXCLAMATIONS[Math.floor(Math.random() * EXCLAMATIONS.length)];
    });
  }

  uwuifySpaces(sentence) {
    return sentence
      .split(' ')
      .map((word) => {
        if (!word || isUri(word) || isProtected(word)) return word;
        if (Math.random() > this.spacesModifier) return word;

        const pool = Math.random() < 0.5 ? FACES : ACTIONS;
        return `${word} ${pool[Math.floor(Math.random() * pool.length)]}`;
      })
      .join(' ');
  }

  uwuifySentence(sentence) {
    if (!sentence || !sentence.trim()) return sentence;
    let result = sentence;
    result = this.uwuifyWords(result);
    result = this.uwuifyExclamations(result);
    result = this.uwuifySpaces(result);
    return result;
  }
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

module.exports = { Uwuifier };
