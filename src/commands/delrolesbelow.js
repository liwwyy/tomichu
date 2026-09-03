const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { successEmbed, failEmbed, warnEmbed, loadingEmbed, plainEmbed } = require('../utils/embeds');
const { buildUsageEmbed } = require('../utils/commandCard');
const { hasManageRoles, canManageRoles } = require('../utils/permissions');
const { resolveRole } = require('../utils/roleResolve');

const ROLE_DELETE_DELAY_MS = 350;
const CONFIRM_TIMEOUT_MS = 60_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const command = {
  name: 'delrolesbelow',
  category: 'Roles',
  description: 'Delete every deletable role positioned below a given role',
  usage: 'delrolesbelow <role>',
  example: ',delrolesbelow @Members',

  async execute(message, args) {
    if (!hasManageRoles(message.member)) {
      return message.reply({
        embeds: [failEmbed(message.author.id, "You don't have the `Manage Roles` permission to use this command")],
      });
    }

    if (!canManageRoles(message.guild)) {
      return message.reply({ embeds: [failEmbed(message.author.id, 'I need the `Manage Roles` permission to do this')] });
    }

    const target = resolveRole(message.guild, args[0]);
    if (!target) {
      return message.reply({ embeds: [buildUsageEmbed(command)] });
    }

    await message.guild.roles.fetch();

    const toDelete = [...message.guild.roles.cache.values()].filter(
      (role) => role.position < target.position && role.id !== message.guild.id && role.editable,
    );

    if (toDelete.length === 0) {
      return message.reply({ embeds: [plainEmbed(`No deletable roles below **${target.name}**`)] });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('delrolesbelow_confirm').setLabel('Delete all').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('delrolesbelow_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
    );

    const response = await message.reply({
      embeds: [warnEmbed(message.author.id, `Delete **${toDelete.length}** role(s) below **${target.name}**? This cannot be undone`)],
      components: [row],
    });

    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: CONFIRM_TIMEOUT_MS,
      max: 1,
    });

    collector.on('collect', async (interaction) => {
      if (interaction.user.id !== message.author.id || !interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return interaction.reply({
          embeds: [failEmbed(interaction.user.id, 'Only the command author can confirm this')],
          flags: MessageFlags.Ephemeral,
        });
      }

      if (interaction.customId === 'delrolesbelow_cancel') {
        return interaction.update({ embeds: [successEmbed(message.author.id, 'Delete cancelled')], components: [] });
      }

      await interaction.update({
        embeds: [loadingEmbed(message.author.id, `Deleting **${toDelete.length}** role(s)`)],
        components: [],
      });

      let success = 0;
      let failed = 0;
      for (const role of toDelete) {
        try {
          await role.delete('tomichu ,delrolesbelow');
          success++;
        } catch {
          failed++;
        }
        await sleep(ROLE_DELETE_DELAY_MS);
      }

      const summary = failed > 0 ? `Deleted **${success}** role(s) — **${failed}** failed` : `Deleted **${success}** role(s)`;
      await response.edit({ embeds: [failed > 0 ? warnEmbed(message.author.id, summary) : successEmbed(message.author.id, summary)] });
    });

    collector.on('end', (collected) => {
      if (collected.size === 0) {
        response.edit({ embeds: [plainEmbed('Confirmation timed out')], components: [] }).catch(() => {});
      }
    });
  },
};

module.exports = command;
