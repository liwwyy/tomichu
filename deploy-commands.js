require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { loadSlashCommands } = require('./src/slashCommands');
const config = require('./src/config');

if (!config.token || !config.clientId) {
  console.error('Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in your .env');
  process.exit(1);
}

const slashCommands = loadSlashCommands();
const body = [...slashCommands.values()].map((command) => command.data.toJSON());

const rest = new REST().setToken(config.token);

(async () => {
  try {
    console.log(`Deploying ${body.length} slash command(s): ${[...slashCommands.keys()].join(', ')}`);
    await rest.put(Routes.applicationCommands(config.clientId), { body });
    console.log('Slash commands deployed globally (can take up to an hour to show everywhere)');
  } catch (err) {
    console.error('Failed to deploy slash commands:', err);
    process.exit(1);
  }
})();
