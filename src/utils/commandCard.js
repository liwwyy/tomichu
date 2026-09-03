const { EmbedBuilder } = require('discord.js');
const { COLORS } = require('../constants/theme');

const CREDIT_USER_ID = '1476376719668674620';

// Shown when a command is called without its required argument.
// Pulls straight from the command's own metadata so this never drifts
// out of sync with the command itself.
function buildUsageEmbed(command) {
  return new EmbedBuilder()
    .setColor(COLORS.neutral)
    .setTitle(`Command: ${command.name}`)
    .setDescription(`-# ${command.description}`)
    .addFields({
      name: 'How To Use',
      value: `\`\`\`yaml\nSyntax:  ${command.usage}\nExample: ${command.example}\n\`\`\``,
    });
}

// ,,help - groups commands by category, bot-branded author + footer.
function buildHelpEmbed(commands, client) {
  const seen = new Set();
  const categories = new Map();
  let visibleCount = 0;

  for (const command of commands.values()) {
    if (seen.has(command)) continue;
    seen.add(command);
    if (command.disabled) continue;

    visibleCount++;
    const category = command.category || 'General';
    if (!categories.has(category)) categories.set(category, []);
    categories.get(category).push(command.name);
  }

  const embed = new EmbedBuilder()
    .setColor(COLORS.neutral)
    .setDescription('-# Discord bot goodies to goof around')
    .setFooter({ text: `${visibleCount} Command${visibleCount === 1 ? '' : 's'}` });

  if (client?.user) {
    embed.setAuthor({
      name: client.user.username,
      iconURL: client.user.displayAvatarURL({ extension: 'png', size: 256 }),
    });
  }

  for (const [category, names] of categories) {
    embed.addFields({ name: category, value: `\`\`\`\n${names.join(', ')}\n\`\`\``, inline: false });
  }

  embed.addFields({ name: '\u200b', value: `made with ♥ by <@${CREDIT_USER_ID}>`, inline: false });

  return embed;
}

module.exports = { buildUsageEmbed, buildHelpEmbed };
