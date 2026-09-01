const { buildHelpEmbed } = require('../utils/commandCard');

module.exports = {
  name: 'help',
  async execute(message, { commands }) {
    await message.reply({ embeds: [buildHelpEmbed(commands, message.client)] });
  },
};
