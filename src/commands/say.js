const { failEmbed } = require('../utils/embeds');
const { buildUsageEmbed } = require('../utils/commandCard');
const { sendAsUser } = require('../utils/webhook');
const { buildQuoteEmbed } = require('../utils/quoteEmbed');
const { canManageMessages } = require('../utils/permissions');

const command = {
  name: 'say',
  category: 'Messages',
  description: 'Send a message impersonating you',
  usage: 'say <message>',
  example: ',say Hello there',

  async execute(message, args) {
    const content = args.join(' ').trim();
    const attachments = [...message.attachments.values()];

    if (!content && attachments.length === 0) {
      return message.reply({ embeds: [buildUsageEmbed(command)] });
    }

    const files = attachments.map((attachment) => attachment.url);

    try {
      if (message.reference) {
        const repliedMessage = await message.fetchReference().catch(() => null);
        if (repliedMessage) {
          const quoteEmbed = buildQuoteEmbed(repliedMessage);
          await sendAsUser(message.channel, message.member, { embeds: [quoteEmbed] });
        }
      }

      await sendAsUser(message.channel, message.member, {
        content: content || undefined,
        files: files.length ? files : undefined,
      });

      if (canManageMessages(message.guild, message.channel)) {
        await message.delete().catch((err) => console.warn('Could not delete ,say message:', err.message));
      } else {
        console.warn(
          `Missing "Manage Messages" permission in #${message.channel.name} — can't delete ,say command messages`,
        );
      }
    } catch (err) {
      console.error('Error running ,say:', err);
      await message
        .reply({ embeds: [failEmbed(message.author.id, "Couldn't send that — check my `Manage Webhooks` permission")] })
        .catch(() => {});
    }
  },
};

module.exports = command;
