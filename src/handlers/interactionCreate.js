const { MessageFlags } = require('discord.js');
const { handleButtonInteraction, handleSelectInteraction } = require('../features/selfRoles');

function createInteractionHandler(slashCommands) {
  return async function interactionCreate(interaction) {
    if (interaction.isChatInputCommand()) {
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
      return;
    }

    // Self-role buttons/selects are prefixed "selfrole:" — anything else
    // (like the nickall/nickallreset confirm buttons) is handled by its
    // own per-message collector, not here.
    if (interaction.isButton() && interaction.customId.startsWith('selfrole:btn:')) {
      try {
        await handleButtonInteraction(interaction);
      } catch (err) {
        console.error('Error handling self-role button:', err);
      }
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('selfrole:sel:')) {
      try {
        await handleSelectInteraction(interaction);
      } catch (err) {
        console.error('Error handling self-role select menu:', err);
      }
      return;
    }
  };
}

module.exports = { createInteractionHandler };
