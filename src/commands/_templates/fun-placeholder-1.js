// TEMPLATE — this file is NOT active as-is.
// To activate it: move (or copy) this file up one level into
// src/commands/, then restart the bot. tomichu auto-loads everything in
// src/commands/ on startup, so nothing else needs to be registered.
//
// Fields:
//   name         the command word after the prefix, e.g. ',placeholder1'
//   aliases      optional array of extra names that trigger the same command
//   category     heading this shows under in ,,help
//   description  one-line summary shown in ,,help and the usage card
//   usage        syntax shown in the usage card, e.g. 'ping' or 'nickall <nickname>'
//   example      a real example shown in the usage card, e.g. ',ping'
//   execute      async (message, args, client) => { ... }
//     message: the Discord.js Message that triggered this
//     args:    array of words typed after the command name
//     client:  the bot's Client instance

module.exports = {
  name: 'placeholder1',
  category: 'Fun',
  description: 'TODO: describe what this command does',
  usage: 'placeholder1',
  example: ',placeholder1',

  async execute(message, args) {
    // TODO: your command logic here.
    await message.reply('placeholder1 is not implemented yet');
  },
};
