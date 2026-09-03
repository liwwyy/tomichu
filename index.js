const { Client, GatewayIntentBits, Partials } = require('discord.js');
const config = require('./src/config');
const { loadCommands } = require('./src/commands');
const { loadSlashCommands } = require('./src/slashCommands');
const { loadDoubleCommands } = require('./src/doubleCommands');
const { createMessageHandler } = require('./src/handlers/messageCreate');
const { createInteractionHandler } = require('./src/handlers/interactionCreate');
const { updatePresence } = require('./src/utils/presence');
const { handleLockedMessage } = require('./src/features/uwulock');
const { handleReactionAdd, handleReactionRemove } = require('./src/features/selfRoles');
const { ensureAppEmojisLoaded } = require('./src/utils/emojiResolver');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  // Reaction-role messages can be older than the bot's cache — partials
  // let those events through instead of silently dropping them.
  partials: [Partials.Message, Partials.Reaction, Partials.User],
});

const commands = loadCommands();
const slashCommands = loadSlashCommands();
const doubleCommands = loadDoubleCommands();

client.once('clientReady', async () => {
  console.log(`tomichu online as ${client.user.tag} — loaded commands: ${[...commands.keys()].join(', ')}`);
  console.log(`Double-prefix commands: ${[...doubleCommands.keys()].join(', ')}`);
  console.log(`Slash commands ready (run "npm run deploy" to register): ${[...slashCommands.keys()].join(', ')}`);
  updatePresence(client);

  try {
    await ensureAppEmojisLoaded(client);
    console.log(`Loaded ${client.application.emojis.cache.size} application emoji(s)`);
  } catch (err) {
    console.error('Failed to load application emojis:', err);
  }
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

client.on('messageReactionAdd', (reaction, user) =>
  handleReactionAdd(reaction, user).catch((err) => console.error('Error in messageReactionAdd handler:', err)),
);
client.on('messageReactionRemove', (reaction, user) =>
  handleReactionRemove(reaction, user).catch((err) => console.error('Error in messageReactionRemove handler:', err)),
);

client.login(config.token);
