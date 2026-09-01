const { successEmbed, failEmbed, plainEmbed } = require('../utils/embeds');
const { hasManageMessages } = require('../utils/permissions');
const { clearGuild } = require('../features/uwulock');

const command = {
  name: 'uwuclear',
  category: 'Fun',
  description: 'Clear every uwu-lock in this server',
  usage: 'uwuclear',
  example: ',uwuclear',

  async execute(message) {
    if (!hasManageMessages(message.member)) {
      return message.reply({
        embeds: [failEmbed(message.author.id, "You don't have the `Manage Messages` permission to use this command")],
      });
    }

    const count = clearGuild(message.guild.id);
    const text = count > 0 ? `Cleared **${count}** uwu-lock(s)` : 'No uwu-locks to clear';

    return message.reply({ embeds: [count > 0 ? successEmbed(message.author.id, text) : plainEmbed(text)] });
  },
};

module.exports = command;
