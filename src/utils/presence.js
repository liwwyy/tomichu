const { ActivityType } = require('discord.js');

function getMemberCount(client) {
  return client.guilds.cache.reduce((total, guild) => total + (guild.memberCount || 0), 0);
}

function updatePresence(client) {
  if (!client.user) return;

  const memberCount = getMemberCount(client);

  client.user.setPresence({
    status: 'online',
    activities: [
      // Custom status bubble.
      { name: 'Custom Status', type: ActivityType.Custom, state: ',,help for welp!' },
      // Renders as "Watching Vibing with N members".
      { name: `Vibing with ${memberCount} members`, type: ActivityType.Watching },
    ],
  });
}

module.exports = { updatePresence, getMemberCount };
