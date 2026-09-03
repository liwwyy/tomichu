const { successEmbed, failEmbed, warnEmbed, plainEmbed } = require('../utils/embeds');
const { buildUsageEmbed } = require('../utils/commandCard');
const { hasManageRoles, canManageRoles } = require('../utils/permissions');
const { getMessage, removeMessage } = require('../utils/registry');

const ROLE_DELETE_DELAY_MS = 350;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const command = {
  name: 'undoembed',
  category: 'Self Roles',
  description: 'Delete every role created by a self-role message and stop tracking it',
  usage: 'undoembed <message_id>',
  example: ',undoembed 1234567890123456789',

  async execute(message, args) {
    if (!hasManageRoles(message.member)) {
      return message.reply({
        embeds: [failEmbed(message.author.id, "You don't have the `Manage Roles` permission to use this command")],
      });
    }

    if (!canManageRoles(message.guild)) {
      return message.reply({
        embeds: [failEmbed(message.author.id, 'I need the `Manage Roles` permission to do this')],
      });
    }

    const messageId = args[0];
    if (!messageId) {
      return message.reply({ embeds: [buildUsageEmbed(command)] });
    }

    const entry = getMessage(messageId);
    if (!entry || entry.guildId !== message.guild.id) {
      return message.reply({
        embeds: [failEmbed(message.author.id, "No tracked self-role message with that ID in this server — it may predate this feature, or already be undone")],
      });
    }

    const roleIds = [...new Set(entry.sections.flatMap((section) => section.roleIds ?? []))];

    let deleted = 0;
    let failed = 0;

    for (const roleId of roleIds) {
      const role = message.guild.roles.cache.get(roleId);
      try {
        if (role) {
          await role.delete('tomichu ,undoembed');
        }
        deleted++;
      } catch (err) {
        failed++;
      }
      await sleep(ROLE_DELETE_DELAY_MS);
    }

    // Best-effort cleanup of the original message — not fatal if it's
    // already gone.
    try {
      const channel = await message.client.channels.fetch(entry.channelId);
      const original = await channel.messages.fetch(messageId);
      await original.edit({ content: null, embeds: [plainEmbed('This self-role message has been undone')], components: [] });
      await original.reactions.removeAll().catch(() => {});
    } catch {
      // original message may already be deleted or inaccessible
    }

    await removeMessage(messageId);

    const text = failed > 0 ? `Deleted **${deleted}** role(s) — **${failed}** failed` : `Deleted **${deleted}** role(s)`;
    return message.reply({ embeds: [failed > 0 ? warnEmbed(message.author.id, text) : successEmbed(message.author.id, text)] });
  },
};

module.exports = command;
