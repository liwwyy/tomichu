const { Uwuifier } = require('../utils/uwuifier');
const { sendAsUser } = require('../utils/webhook');
const { canManageMessages } = require('../utils/permissions');

const uwuifier = new Uwuifier();

// Feature-wide kill switch — flip to false to re-enable. Keeps existing
// locks (if any) intact rather than clearing them, so nothing is lost by
// disabling.
const FEATURE_DISABLED = true;

// guildId -> Set<userId>. In-memory only — locks reset on restart.
const lockedUsers = new Map();

function getGuildSet(guildId) {
  if (!lockedUsers.has(guildId)) lockedUsers.set(guildId, new Set());
  return lockedUsers.get(guildId);
}

function isLocked(guildId, userId) {
  return lockedUsers.get(guildId)?.has(userId) ?? false;
}

// Toggles the lock. Returns true if the user is now locked, false if the
// lock was just removed.
function toggleLock(guildId, userId) {
  const set = getGuildSet(guildId);
  if (set.has(userId)) {
    set.delete(userId);
    return false;
  }
  set.add(userId);
  return true;
}

// Returns true if a lock actually existed and was removed.
function removeLock(guildId, userId) {
  return lockedUsers.get(guildId)?.delete(userId) ?? false;
}

// Clears every lock in the guild, returns how many were cleared.
function clearGuild(guildId) {
  const set = lockedUsers.get(guildId);
  const count = set?.size ?? 0;
  lockedUsers.delete(guildId);
  return count;
}

// Called for any guild message that wasn't a recognized command. If the
// author is locked, uwuifies their message, re-sends it via webhook as
// them, and deletes the original. Returns true if it handled the message.
async function handleLockedMessage(message) {
  if (FEATURE_DISABLED) return false;
  if (!message.guild || !isLocked(message.guild.id, message.author.id)) return false;
  if (!message.content?.trim() && message.attachments.size === 0) return false;

  const uwuified = uwuifier.uwuifySentence(message.content || '');
  const files = [...message.attachments.values()].map((attachment) => attachment.url);

  try {
    await sendAsUser(message.channel, message.member, {
      content: uwuified || undefined,
      files: files.length ? files : undefined,
    });

    if (canManageMessages(message.guild, message.channel)) {
      await message.delete().catch((err) => console.warn('Could not delete uwu-locked message:', err.message));
    } else {
      console.warn(
        `Missing "Manage Messages" permission in #${message.channel.name} — can't delete uwu-locked messages`,
      );
    }
  } catch (err) {
    console.error('Error handling uwu-locked message:', err);
  }

  return true;
}

module.exports = { isLocked, toggleLock, removeLock, clearGuild, handleLockedMessage };
