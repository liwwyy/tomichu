const { EmbedBuilder } = require('discord.js');

// Discord's own dark embed background color, so this blends in rather
// than standing out.
const QUOTE_COLOR = 0x2f3136;
const QUOTE_PREVIEW_LIMIT = 120;

function truncate(text) {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > QUOTE_PREVIEW_LIMIT ? `${clean.slice(0, QUOTE_PREVIEW_LIMIT - 1)}…` : clean;
}

// Figures out what the quoted message actually contains, since a reply
// might be to an image, a sticker, or an embed with no text at all.
function describeContent(message) {
  if (message.content && message.content.trim()) {
    return { text: truncate(message.content), isPlaceholder: false };
  }

  const attachment = message.attachments?.first?.();
  if (attachment) {
    const type = attachment.contentType || '';
    if (type.startsWith('image/')) return { text: '[image]', isPlaceholder: true };
    if (type.startsWith('video/')) return { text: '[video]', isPlaceholder: true };
    if (type.startsWith('audio/')) return { text: '[audio]', isPlaceholder: true };
    return { text: '[attachment]', isPlaceholder: true };
  }

  if (message.stickers?.size) return { text: '[sticker]', isPlaceholder: true };
  if (message.embeds?.length) return { text: '[embed]', isPlaceholder: true };

  return { text: '[no content]', isPlaceholder: true };
}

function buildQuoteEmbed(repliedMessage) {
  const authorName = repliedMessage.member?.displayName || repliedMessage.author.username;
  const { text, isPlaceholder } = describeContent(repliedMessage);

  // Real text gets italicized; content-type placeholders like [image] are
  // shown plain since italicizing a label like that reads oddly.
  const line = isPlaceholder ? text : `*${text}*`;

  return new EmbedBuilder()
    .setColor(QUOTE_COLOR)
    .setAuthor({
      name: `Replying to ${authorName}`,
      iconURL: repliedMessage.author.displayAvatarURL({ extension: 'png', size: 256 }),
    })
    .setDescription(`┌ ${line}`);
}

module.exports = { buildQuoteEmbed };
