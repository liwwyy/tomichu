const { successEmbed, failEmbed, warnEmbed } = require('../utils/embeds');
const { buildUsageEmbed } = require('../utils/commandCard');
const { hasManageRoles, canManageRoles } = require('../utils/permissions');

const ROLE_CREATE_DELAY_MS = 350;
const MAX_ROLES_PER_CALL = 25;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const command = {
  name: 'mkroles',
  category: 'Roles',
  description: 'Create multiple roles at once from a comma-separated list — skips ones that already exist',
  usage: 'mkroles <name1, name2, name3>',
  example: ',mkroles Gamer, Artist, Musician',

  async execute(message, args) {
    if (!hasManageRoles(message.member)) {
      return message.reply({
        embeds: [failEmbed(message.author.id, "You don't have the `Manage Roles` permission to use this command")],
      });
    }

    if (!canManageRoles(message.guild)) {
      return message.reply({ embeds: [failEmbed(message.author.id, 'I need the `Manage Roles` permission to do this')] });
    }

    const raw = args.join(' ').trim();
    if (!raw) {
      return message.reply({ embeds: [buildUsageEmbed(command)] });
    }

    const names = [...new Set(raw.split(',').map((name) => name.trim()).filter(Boolean))];

    if (names.length === 0) {
      return message.reply({ embeds: [buildUsageEmbed(command)] });
    }

    if (names.length > MAX_ROLES_PER_CALL) {
      return message.reply({
        embeds: [failEmbed(message.author.id, `Max ${MAX_ROLES_PER_CALL} roles per call — you gave ${names.length}`)],
      });
    }

    await message.guild.roles.fetch();

    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const name of names) {
      const existing = message.guild.roles.cache.find((role) => role.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        skipped++;
        await sleep(ROLE_CREATE_DELAY_MS);
        continue;
      }

      try {
        // No permissions on any created role, ever — omitting this
        // silently copies @everyone's current permission set instead.
        await message.guild.roles.create({ name, permissions: [], reason: 'tomichu ,mkroles' });
        created++;
      } catch {
        failed++;
      }
      await sleep(ROLE_CREATE_DELAY_MS);
    }

    const parts = [`Created **${created}**`];
    if (skipped > 0) parts.push(`skipped **${skipped}** (already existed)`);
    if (failed > 0) parts.push(`**${failed}** failed`);

    const text = parts.join(' — ');
    return message.reply({ embeds: [failed > 0 ? warnEmbed(message.author.id, text) : successEmbed(message.author.id, text)] });
  },
};

module.exports = command;
