const { SlashCommandBuilder, ApplicationIntegrationType, InteractionContextType, EmbedBuilder, MessageFlags } = require('discord.js');
const { failEmbed } = require('../utils/embeds');
const { sendAsUser } = require('../utils/webhook');
const { buildQuoteEmbed } = require('../utils/quoteEmbed');

// A message a webhook can't send — the bot's own account posts instead,
// styled as a small embed so it's still clear whose words these are.
function buildRelayEmbed(interaction, content) {
  const displayName = interaction.member?.displayName ?? interaction.user.globalName ?? interaction.user.username;
  return new EmbedBuilder()
    .setAuthor({ name: displayName, iconURL: interaction.user.displayAvatarURL({ extension: 'png', size: 256 }) })
    .setDescription(content);
}

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

    // True webhook impersonation needs a real guild channel tomichu is
    // actually a member of — only possible when guild-installed there.
    // Everywhere else (DMs, group DMs, or a guild tomichu itself isn't
    // in via a user install) there's no webhook access at all, so the
    // bot's own account posts the message instead — see the try/catch
    // below, which is the real fallback trigger regardless of this
    // upfront guess.
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
          await sendAsUser(interaction.channel, interaction.member, { embeds: [buildQuoteEmbed(repliedMessage)] });
        }

        await sendAsUser(interaction.channel, interaction.member, {
          content,
          files: media ? [media.url] : undefined,
        });

        await interaction.deleteReply().catch(() => {});
        return;
      } catch (err) {
        console.warn('Webhook impersonation unavailable here, sending from tomichu\'s own account instead:', err.message);
        // falls through to the bot-account path below
      }
    }

    // Bot's own account path — used in DMs, group DMs, and any server
    // tomichu isn't actually a member of. No webhook is possible there,
    // so this posts as tomichu itself, styled with your name/avatar.
    try {
      if (replyToId && interaction.channel?.messages) {
        const repliedMessage = await interaction.channel.messages.fetch(replyToId).catch(() => null);
        if (repliedMessage) {
          await interaction.followUp({ embeds: [buildQuoteEmbed(repliedMessage)] });
        }
      }

      await interaction.followUp({
        embeds: [buildRelayEmbed(interaction, content)],
        files: media ? [media.url] : undefined,
      });

      await interaction.deleteReply().catch(() => {});
    } catch (err) {
      console.error('Error running /say (bot-account path):', err);
      await interaction.editReply({
        embeds: [failEmbed(interaction.user.id, "Couldn't send that here")],
      }).catch(() => {});
    }
  },
};
