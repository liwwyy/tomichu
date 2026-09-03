const { SlashCommandBuilder, ApplicationIntegrationType, InteractionContextType, MessageFlags } = require('discord.js');
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
    )
    // Installable to a user's own account, not just to servers — lets
    // /say work in DMs, group DMs, and servers tomichu itself isn't in.
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel),

  async execute(interaction) {
    const content = interaction.options.getString('message', true);
    const media = interaction.options.getAttachment('media');
    const replyToId = interaction.options.getString('reply_to');

    // True webhook impersonation needs a real guild channel tomichu has
    // access to — only possible when guild-installed. User-installed
    // use in a DM, group DM, or a guild tomichu itself isn't in has no
    // webhook access at all, so those fall back to a plain relayed
    // message further down.
    const canImpersonate = interaction.inGuild() && Boolean(interaction.channel) && Boolean(interaction.member);

    // Defer ephemerally so the interaction doesn't time out while the
    // message(s) go out, then delete it on success so nothing visible is
    // left behind — no "message sent" confirmation either way.
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (canImpersonate) {
      try {
        if (replyToId) {
          const repliedMessage = await interaction.channel.messages.fetch(replyToId).catch(() => null);
          if (!repliedMessage) {
            return interaction.editReply({
              embeds: [failEmbed(interaction.user.id, "Couldn't find that message ID in this channel — double check it")],
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
        return;
      } catch (err) {
        console.warn('Webhook impersonation unavailable, falling back to a plain relayed message:', err.message);
        // falls through to the plain fallback below
      }
    }

    // Fallback for DMs, group DMs, or a guild tomichu isn't actually a
    // member of: no webhook is possible, so just relay the message as a
    // labeled plain message instead of true impersonation.
    try {
      const displayName = interaction.member?.displayName ?? interaction.user.globalName ?? interaction.user.username;

      if (replyToId && interaction.channel?.messages) {
        const repliedMessage = await interaction.channel.messages.fetch(replyToId).catch(() => null);
        if (repliedMessage) {
          await interaction.followUp({ embeds: [buildQuoteEmbed(repliedMessage)] });
        }
      }

      await interaction.followUp({
        content: `**${displayName}:** ${content}`,
        files: media ? [media.url] : undefined,
        allowedMentions: { parse: [] },
      });

      await interaction.deleteReply().catch(() => {});
    } catch (err) {
      console.error('Error running /say (fallback path):', err);
      await interaction.editReply({
        embeds: [failEmbed(interaction.user.id, "Couldn't send that here")],
      }).catch(() => {});
    }
  },
};
