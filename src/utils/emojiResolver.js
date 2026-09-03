// Templates reference emoji by NAME ("wings_t", "1_", or a plain unicode
// character) rather than hardcoded snowflake IDs — IDs are per-bot, so a
// hardcoded ID from any other application is dead on arrival here.
// Everything gets resolved against tomichu's own application emojis
// (uploaded via the dev portal) at runtime instead.

async function ensureAppEmojisLoaded(client) {
  if (client.application.emojis.cache.size === 0) {
    await client.application.emojis.fetch();
  }
}

// Returns { id, name } for a matched application emoji, or { unicode }
// if the key isn't a known application emoji name (treated as a literal
// emoji straight from the template, e.g. "💜").
function resolveEmojiKey(client, key) {
  const appEmoji = client.application.emojis.cache.find((emoji) => emoji.name === key);
  if (appEmoji) return { id: appEmoji.id, name: appEmoji.name };
  return { unicode: key };
}

// Markdown form for use inside embed text (headers/footers/content).
function emojiMarkdown(resolved) {
  return resolved.id ? `<:${resolved.name}:${resolved.id}>` : resolved.unicode;
}

// Shape discord.js expects for ButtonBuilder#setEmoji / select option emoji.
function emojiIdentifier(resolved) {
  return resolved.id ? { id: resolved.id, name: resolved.name } : resolved.unicode;
}

// Shape message.react() expects.
function emojiReactionIdentifier(resolved) {
  return resolved.id ? `${resolved.name}:${resolved.id}` : resolved.unicode;
}

// Replaces {tokenName} placeholders in template text with resolved emoji markdown.
function substituteEmojiTokens(client, text) {
  if (!text) return text;
  return text.replace(/\{(\w+)\}/g, (match, key) => emojiMarkdown(resolveEmojiKey(client, key)));
}

module.exports = {
  ensureAppEmojisLoaded,
  resolveEmojiKey,
  emojiMarkdown,
  emojiIdentifier,
  emojiReactionIdentifier,
  substituteEmojiTokens,
};
