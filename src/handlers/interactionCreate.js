const { MessageFlags } = require('discord.js');

function createInteractionHandler(slashCommands) {
  return async function interactionCreate(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const command = slashCommands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`Error running slash command "${interaction.commandName}":`, err);
      const payload = { content: 'Something went wrong running that command', flags: MessageFlags.Ephemeral };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
  };
}

module.exports = { createInteractionHandler };
