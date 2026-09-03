const { PermissionFlagsBits } = require('discord.js');

function hasManageNicknames(member) {
  return member.permissions.has(PermissionFlagsBits.ManageNicknames);
}

function hasManageMessages(member) {
  return member.permissions.has(PermissionFlagsBits.ManageMessages);
}

function hasManageRoles(member) {
  return member.permissions.has(PermissionFlagsBits.ManageRoles);
}

function isBotUser(member) {
  return member.user.bot;
}

// Whether tomichu can delete messages in this channel — required for
// ,say to remove the original command message.
function canManageMessages(guild, channel) {
  const me = guild.members.me;
  if (!me) return false;
  return channel.permissionsFor(me)?.has(PermissionFlagsBits.ManageMessages) ?? false;
}

// Whether tomichu can create/assign roles in this guild — required for
// ,sendembed.
function canManageRoles(guild) {
  const me = guild.members.me;
  if (!me) return false;
  return me.permissions.has(PermissionFlagsBits.ManageRoles);
}

// Whether tomichu is actually able to change this member's nickname:
// not the owner, not itself, and tomichu's top role must sit above theirs.
function canManageMember(guild, member) {
  const me = guild.members.me;
  if (!me) return false;
  if (member.id === guild.ownerId) return false;
  if (member.id === me.id) return false;
  return me.roles.highest.position > member.roles.highest.position;
}

// Members tomichu can actually act on for a bulk operation.
// Bots are excluded by default.
function getEligibleMembers(guild, { includeBots = false } = {}) {
  return guild.members.cache.filter((member) => {
    if (!includeBots && isBotUser(member)) return false;
    return canManageMember(guild, member);
  });
}

module.exports = {
  hasManageNicknames,
  hasManageMessages,
  hasManageRoles,
  isBotUser,
  canManageMember,
  canManageMessages,
  canManageRoles,
  getEligibleMembers,
};
