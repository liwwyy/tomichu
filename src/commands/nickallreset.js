const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const { successEmbed, failEmbed, warnEmbed, loadingEmbed, plainEmbed } = require('../utils/embeds');
const { hasManageNicknames, getEligibleMembers } = require('../utils/permissions');
const { bulkSetNicknames, DELAY_MS } = require('../utils/nickname');

const CONFIRM_TIMEOUT_MS = 60_000;

const command = {
  name: 'nickallreset',
  category: 'Bulk Actions',
  description: "Reset every member's nickname",
  usage: 'nickallreset',
  example: ',nickallreset',

  async execute(message, args) {
    if (!hasManageNicknames(message.member)) {
      return message.reply({
        embeds: [failEmbed(message.author.id, "You don't have the `Manage Nicknames` permission to use this command")],
      });
    }

    // No arguments needed — the command name itself says what it does.
    // Fetch the full member list first. Without this, guild.members.cache
    // only has whatever members happened to already be cached (often a
    // small handful) — this was the "only 7 users" bug.
    await message.guild.members.fetch();

    const eligible = [...getEligibleMembers(message.guild).values()].filter((m) => m.nickname !== null);

    if (eligible.length === 0) {
      return message.reply({ embeds: [plainEmbed('No members need updating')] });
    }

    const estSeconds = Math.max(1, Math.ceil((eligible.length * DELAY_MS) / 1000));
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('nickallreset_confirm').setLabel('Rename all').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('nickallreset_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
    );

    const response = await message.reply({
      embeds: [
        warnEmbed(
          message.author.id,
          `Reset **${eligible.length}** member(s)' nicknames? (est. ${estSeconds}s) This cannot be undone`,
        ),
      ],
      components: [row],
    });

    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: CONFIRM_TIMEOUT_MS,
      max: 1,
    });

    collector.on('collect', async (interaction) => {
      if (interaction.user.id !== message.author.id || !interaction.member.permissions.has(PermissionFlagsBits.ManageNicknames)) {
        return interaction.reply({
          embeds: [failEmbed(interaction.user.id, 'Only the command author can confirm this')],
          flags: MessageFlags.Ephemeral,
        });
      }

      if (interaction.customId === 'nickallreset_cancel') {
        return interaction.update({ embeds: [successEmbed(message.author.id, 'Rename all cancelled')], components: [] });
      }

      // Edit the message in place instead of an ephemeral reply.
      await interaction.update({
        embeds: [loadingEmbed(message.author.id, `Renaming **${eligible.length}** member(s)`)],
        components: [],
      });

      const { success, failed } = await bulkSetNicknames(eligible, null);

      const summary =
        failed > 0
          ? `Updated **${success}** member(s) — **${failed}** failed (role hierarchy or permissions)`
          : `Successfully updated **${success}** member(s)`;

      const finalEmbed = failed > 0 ? warnEmbed(message.author.id, summary) : successEmbed(message.author.id, summary);
      await response.edit({ embeds: [finalEmbed] });
    });

    collector.on('end', (collected) => {
      if (collected.size === 0) {
        response.edit({ embeds: [plainEmbed('Confirmation timed out')], components: [] }).catch(() => {});
      }
    });
  },
};

module.exports = command;
