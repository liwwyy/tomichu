const { Client, GatewayIntentBits } = require('discord.js');
const config = require('./config');
const { loadCommands } = require('./commands');
const { loadSlashCommands } = require('./slashCommands');
const { loadDoubleCommands } = require('./doubleCommands');
const { createMessageHandler } = require('./handlers/messageCreate');
const { createInteractionHandler } = require('./handlers/interactionCreate');
const { updatePresence } = require('./utils/presence');
const { handleLockedMessage } = require('./features/uwulock');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

const commands = loadCommands();
const slashCommands = loadSlashCommands();
const doubleCommands = loadDoubleCommands();

client.once('clientReady', () => {
  console.log(`tomichu online as ${client.user.tag} — loaded commands: ${[...commands.keys()].join(', ')}`);
  console.log(`Double-prefix commands: ${[...doubleCommands.keys()].join(', ')}`);
  console.log(`Slash commands ready (run "npm run deploy" to register): ${[...slashCommands.keys()].join(', ')}`);
  updatePresence(client);
});

// Keep the member-count activity fresh as members join/leave or the bot
// joins/leaves guilds.
client.on('guildCreate', () => updatePresence(client));
client.on('guildDelete', () => updatePresence(client));
client.on('guildMemberAdd', () => updatePresence(client));
client.on('guildMemberRemove', () => updatePresence(client));

// Fallback refresh in case any of the above events get missed.
setInterval(() => updatePresence(client), 10 * 60 * 1000);

client.on('messageCreate', createMessageHandler(client, commands, doubleCommands, config.prefix, config.helpPrefix, handleLockedMessage));
client.on('interactionCreate', createInteractionHandler(slashCommands));

client.login(config.token);
