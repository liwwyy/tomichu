const { EmbedBuilder } = require('discord.js');

// Mainstream cup size range, each with the article it actually takes
// when spoken aloud (an "F cup" not "a F cup", etc).
const SIZES = [
  { size: 'AA', article: 'a' },
  { size: 'A', article: 'an' },
  { size: 'B', article: 'a' },
  { size: 'C', article: 'a' },
  { size: 'D', article: 'a' },
  { size: 'DD', article: 'a' },
  { size: 'DDD', article: 'a' },
  { size: 'E', article: 'an' },
  { size: 'F', article: 'an' },
  { size: 'G', article: 'a' },
  { size: 'H', article: 'an' },
];

const BLUSH_EMOJIS = ['😳', '🙈', '🥵', '😅', '🫣', '🥴'];

function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Usually one blush emoji, occasionally two different ones for flavor.
function pickEmojis() {
  const first = pickOne(BLUSH_EMOJIS);
  if (Math.random() < 0.3) {
    let second = pickOne(BLUSH_EMOJIS);
    while (second === first) second = pickOne(BLUSH_EMOJIS);
    return `${first} ${second}`;
  }
  return first;
}

const command = {
  name: 'bra',
  category: 'Fun',
  description: 'Find out your randomly assigned cup size',
  usage: 'bra',
  example: ',bra',

  async execute(message) {
    const { size, article } = pickOne(SIZES);
    const embed = new EmbedBuilder().setDescription(`you're ${article} **${size} cup** ${pickEmojis()}`);
    await message.reply({ embeds: [embed] });
  },
};

module.exports = command;
