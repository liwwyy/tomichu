function resolveRole(guild, arg) {
  if (!arg) return null;

  const mentionMatch = arg.match(/^<@&(\d+)>$/);
  const id = mentionMatch ? mentionMatch[1] : arg;

  const byId = guild.roles.cache.get(id);
  if (byId) return byId;

  const lower = arg.toLowerCase();
  return guild.roles.cache.find((role) => role.name.toLowerCase() === lower) ?? null;
}

module.exports = { resolveRole };
