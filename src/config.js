require('dotenv').config();

module.exports = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.DISCORD_CLIENT_ID,
  prefix: process.env.PREFIX || ',',
  // Separate double-comma prefix, used only for ,,help. Kept distinct so
  // it never collides with the main command prefix.
  helpPrefix: process.env.HELP_PREFIX || ',,',
};
