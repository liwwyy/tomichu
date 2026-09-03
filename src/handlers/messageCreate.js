const { failEmbed, plainEmbed } = require('../utils/embeds');

function createMessageHandler(client, commands, doubleCommands, prefix, helpPrefix, onUnprefixedMessage) {
  return async function messageCreate(message) {
    if (message.author.bot || message.webhookId || !message.guild) return;

    const content = message.content;

    // Double-prefix is checked first since ",,x" also starts with ",".
    // Anything under ",," is looked up in the separate doubleCommands set
    // (currently: help, ping) — never in the regular commands map.
    if (content.startsWith(helpPrefix)) {
      const args = content.slice(helpPrefix.length).trim().split(/ +/);
      const commandName = args.shift()?.toLowerCase();
      if (!commandName) return;

      const doubleCommand = doubleCommands.get(commandName);
      if (!doubleCommand) return;

      try {
        await doubleCommand.execute(message, { client, commands });
      } catch (err) {
        console.error(`Error running double-prefix command "${commandName}":`, err);
      }
      return;
    }

    if (content.startsWith(prefix)) {
      const args = content.slice(prefix.length).trim().split(/ +/);
      const commandName = args.shift()?.toLowerCase();
      if (!commandName) return;

      const command = commands.get(commandName);
      if (!command) return;

      if (command.disabled) {
        return message
          .reply({ embeds: [plainEmbed(command.disabledReason || 'This command is temporarily disabled')] })
          .catch(() => {});
      }

      try {
        await command.execute(message, args, client);
      } catch (err) {
        console.error(`Error running command "${commandName}":`, err);
        message.reply({ embeds: [failEmbed(message.author.id, 'Something went wrong running that command')] }).catch(() => {});
      }
      return;
    }

    // Not a command at all — hand off to feature hooks (e.g. uwulock)
    // that act on plain chat messages.
    if (onUnprefixedMessage) {
      try {
        await onUnprefixedMessage(message);
      } catch (err) {
        console.error('Error in message hook:', err);
      }
    }
  };
}

module.exports = { createMessageHandler };
