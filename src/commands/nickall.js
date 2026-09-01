const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const { successEmbed, failEmbed, warnEmbed, loadingEmbed, plainEmbed } = require('../utils/embeds');
const { buildUsageEmbed } = require('../utils/commandCard');
const { hasManageNicknames, getEligibleMembers } = require('../utils/permissions');
const { bulkSetNicknames, DELAY_MS } = require('../utils/nickname');

const MAX_NICK_LENGTH = 32;
const CONFIRM_TIMEOUT_MS = 60_000;

const command = {
  name: 'nickall',
  category: 'Bulk Actions',
  description: 'Rename every member to the same nickname',
  usage: 'nickall <nickname>',
  example: ',nickall Cool Name',

  async execute(message, args) {
    if (!hasManageNicknames(message.member)) {
      return message.reply({
        embeds: [failEmbed(message.author.id, "You don't have the `Manage Nicknames` permission to use this command")],
      });
    }

    const newNick = args.join(' ').trim();

    if (!newNick) {
      return message.reply({ embeds: [buildUsageEmbed(command)] });
    }

    if (newNick.length > MAX_NICK_LENGTH) {
      return message.reply({
        embeds: [failEmbed(message.author.id, `Nicknames can't be longer than ${MAX_NICK_LENGTH} characters`)],
      });
    }

    // Fetch the full member list first. Without this, guild.members.cache
    // only has whatever members happened to already be cached (often a
    // small handful) — this was the "only 7 users" bug.
    await message.guild.members.fetch();

    const eligible = [...getEligibleMembers(message.guild).values()];

    if (eligible.length === 0) {
      return message.reply({ embeds: [plainEmbed('No members need updating')] });
    }

    const estSeconds = Math.max(1, Math.ceil((eligible.length * DELAY_MS) / 1000));
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('nickall_confirm').setLabel('Rename all').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('nickall_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
    );

    const response = await message.reply({
      embeds: [
        warnEmbed(
          message.author.id,
          `Rename **${eligible.length}** member(s) to **${newNick}**? (est. ${estSeconds}s) This cannot be undone`,
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

      if (interaction.customId === 'nickall_cancel') {
        return interaction.update({ embeds: [successEmbed(message.author.id, 'Rename all cancelled')], components: [] });
      }

      // Edit the message in place instead of an ephemeral reply.
      await interaction.update({
        embeds: [loadingEmbed(message.author.id, `Renaming **${eligible.length}** member(s)`)],
        components: [],
      });

      const { success, failed } = await bulkSetNicknames(eligible, newNick);

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
