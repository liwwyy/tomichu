const { EmbedBuilder } = require('discord.js');
const { COLORS, EMOJIS } = require('../constants/theme');

function successEmbed(userId, text) {
  return new EmbedBuilder()
    .setColor(COLORS.success)
    .setDescription(`${EMOJIS.check}  <@${userId}>: ${text}`);
}

function failEmbed(userId, text) {
  return new EmbedBuilder()
    .setColor(COLORS.fail)
    .setDescription(`${EMOJIS.deny}  <@${userId}>: ${text}`);
}

function warnEmbed(userId, text) {
  return new EmbedBuilder()
    .setColor(COLORS.warn)
    .setDescription(`${EMOJIS.warn}  <@${userId}>: ${text}`);
}

function loadingEmbed(userId, text) {
  return new EmbedBuilder()
    .setColor(COLORS.loading)
    .setDescription(`${EMOJIS.loading}  <@${userId}>: ${text}`);
}

// For usage/help/cancelled messages that aren't tied to a status emoji.
function plainEmbed(text) {
  return new EmbedBuilder().setColor(COLORS.neutral).setDescription(text);
}

module.exports = { successEmbed, failEmbed, warnEmbed, loadingEmbed, plainEmbed };
