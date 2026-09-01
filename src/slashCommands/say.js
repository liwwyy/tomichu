const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { failEmbed } = require('../utils/embeds');
const { sendAsUser } = require('../utils/webhook');
const { buildQuoteEmbed } = require('../utils/quoteEmbed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Send a message impersonating you')
    .addStringOption((option) => option.setName('message').setDescription('The message to send').setRequired(true))
    .addAttachmentOption((option) => option.setName('media').setDescription('Optional image or file to attach').setRequired(false))
    .addStringOption((option) =>
      option.setName('reply_to').setDescription('Message ID in this channel to reply to').setRequired(false),
    ),

  async execute(interaction) {
    const content = interaction.options.getString('message', true);
    const media = interaction.options.getAttachment('media');
    const replyToId = interaction.options.getString('reply_to');

    // Defer ephemerally so the interaction doesn't time out while the
    // webhook message(s) go out, then delete it on success so nothing
    // visible is left behind — no "message sent" confirmation.
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      if (replyToId) {
        const repliedMessage = await interaction.channel.messages.fetch(replyToId).catch(() => null);

        if (!repliedMessage) {
          return interaction.editReply({
            embeds: [
              failEmbed(interaction.user.id, "Couldn't find that message ID in this channel — double check it"),
            ],
          });
        }

        const quoteEmbed = buildQuoteEmbed(repliedMessage);
        await sendAsUser(interaction.channel, interaction.member, { embeds: [quoteEmbed] });
      }

      await sendAsUser(interaction.channel, interaction.member, {
        content,
        files: media ? [media.url] : undefined,
      });

      await interaction.deleteReply().catch(() => {});
    } catch (err) {
      console.error('Error running /say:', err);
      await interaction.editReply({
        embeds: [failEmbed(interaction.user.id, "Couldn't send that — check my `Manage Webhooks` permission")],
      });
    }
  },
};
