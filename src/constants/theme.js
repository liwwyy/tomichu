// Central place for the bot's visual identity, so every command/embed
// stays consistent. Colors are converted from the hsla() values used in
// the reference embeds you sent over.

module.exports = {
  COLORS: {
    success: 0x82c95b, // green
    fail: 0xfd5e5e,    // red
    warn: 0xfec339,    // gold
    loading: 0x99aab5, // neutral grey
    neutral: 0x2b2d31, // plain/info embeds (usage, cancelled, etc.)
  },
  EMOJIS: {
    check: '<:check:1543949762376507543>',
    // NOTE: your "deny emoji markdown" line and fail embed example both
    // use this ID.
    deny: '<:1543276408850092202:1543953474675539968>',
    // NOTE: you listed this ID as the warn emoji, but your confirmation
    // embed example used a different ID (1523794055736066280). Using the
    // one you listed explicitly below — swap if that's wrong.
    warn: '<:warn:1543954189493731510>',
    loading: '<a:load:1543958870513287279>',
  },
};
