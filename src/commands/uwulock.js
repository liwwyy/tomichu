const { successEmbed, failEmbed, plainEmbed } = require('../utils/embeds');
const { buildUsageEmbed } = require('../utils/commandCard');
const { hasManageMessages, isBotUser } = require('../utils/permissions');
const { toggleLock, removeLock } = require('../features/uwulock');

const command = {
  name: 'uwulock',
  aliases: ['uwu'],
  category: 'Fun',
  disabled: true,
  disabledReason: 'uwulock is temporarily disabled',
  description: 'Toggle uwu-lock on a member — their messages get uwuified and resent as them via webhook',
  usage: 'uwulock @member\nuwulock remove @member',
  example: ',uwulock @user\n,uwulock remove @user',

  async execute(message, args) {
    if (!hasManageMessages(message.member)) {
      return message.reply({
        embeds: [failEmbed(message.author.id, "You don't have the `Manage Messages` permission to use this command")],
      });
    }

    const isRemove = args[0]?.toLowerCase() === 'remove';
    const target = message.mentions.members?.first();

    if (!target) {
      return message.reply({ embeds: [buildUsageEmbed(command)] });
    }

    if (isBotUser(target)) {
      return message.reply({ embeds: [failEmbed(message.author.id, "Bots can't be uwu-locked")] });
    }

    if (isRemove) {
      const removed = removeLock(message.guild.id, target.id);
      const text = removed ? `Removed **${target.user.username}**'s uwu-lock` : `**${target.user.username}** isn't uwu-locked`;
      return message.reply({ embeds: [removed ? successEmbed(message.author.id, text) : plainEmbed(text)] });
    }

    const nowLocked = toggleLock(message.guild.id, target.id);
    const text = nowLocked
      ? `**${target.user.username}** is now uwu-locked`
      : `**${target.user.username}**'s uwu-lock removed`;

    return message.reply({ embeds: [successEmbed(message.author.id, text)] });
  },
};

module.exports = command;
