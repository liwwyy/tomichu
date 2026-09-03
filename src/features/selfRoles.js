const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  MessageFlags,
} = require('discord.js');
const { getTemplate } = require('../utils/templates');
const { addMessage, getMessage } = require('../utils/registry');
const {
  ensureAppEmojisLoaded,
  resolveEmojiKey,
  emojiMarkdown,
  emojiIdentifier,
  emojiReactionIdentifier,
  substituteEmojiTokens,
} = require('../utils/emojiResolver');

const ROLE_ACTION_DELAY_MS = 350;
const REACTION_DELAY_MS = 350;
const ROLE_MENTION_INDENT = 'ㅤㅤㅤㅤㅤ';

// Fixed values Discord requires for the holographic role style — sending
// any tertiaryColor at all forces these exact values regardless of what
// you pass, so a template just says "holographic" and we supply them.
const HOLOGRAPHIC_COLORS = { primaryColor: 11127295, secondaryColor: 16759788, tertiaryColor: 16761760 };

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Builds the description from header/content/footer plus a role-mention
// preview block per section, so people can see exactly what they're
// getting before they click/react/select anything.
function buildEmbed(client, template, previewSections) {
  const e = template.embed ?? {};
  const embed = new EmbedBuilder();

  if (e.title) embed.setTitle(e.title);
  if (e.color) embed.setColor(e.color);
  if (e.thumbnail) embed.setThumbnail(e.thumbnail);

  const showHeadings = previewSections.length > 1;
  const bodyBlocks = previewSections.map((section) => {
    const heading = showHeadings && section.heading ? `**${section.heading}**\n` : '';
    const lines = section.entries.map(({ emojiKey, roleId }) => {
      const emoji = emojiMarkdown(resolveEmojiKey(client, emojiKey));
      return `${ROLE_MENTION_INDENT}${emoji}<@&${roleId}>`;
    });
    return heading + lines.join('\n');
  });

  const parts = [e.header, e.content, bodyBlocks.join('\n\n'), e.footer]
    .map((part) => substituteEmojiTokens(client, part))
    .filter(Boolean);

  if (parts.length) embed.setDescription(parts.join('\n\n'));

  return embed;
}

function resolveRoleColorOptions(roleDef) {
  if (roleDef.colorType === 'holographic') {
    return { colors: HOLOGRAPHIC_COLORS };
  }
  if (roleDef.colorType === 'gradient' && roleDef.primary && roleDef.secondary) {
    return { colors: { primaryColor: roleDef.primary, secondaryColor: roleDef.secondary } };
  }
  if (roleDef.primary) {
    return { color: roleDef.primary };
  }
  return {};
}

// Finds an existing role by name (case-insensitive), or creates it.
// Every created role gets explicit `permissions: []` — Discord's API
// silently copies @everyone's CURRENT permission set onto any new role
// that omits this field, which is a well-known footgun.
async function ensureRole(guild, roleDef) {
  const existing = guild.roles.cache.find((role) => role.name.toLowerCase() === roleDef.name.toLowerCase());
  if (existing) return existing;

  const colorOptions = resolveRoleColorOptions(roleDef);

  try {
    return await guild.roles.create({
      name: roleDef.name,
      permissions: [],
      reason: 'tomichu self-role template',
      ...colorOptions,
    });
  } catch (err) {
    if (colorOptions.colors) {
      console.warn(`Falling back to solid color for role "${roleDef.name}" (likely insufficient boost level):`, err.message);
      const fallback = roleDef.primary ? { color: roleDef.primary } : {};
      return guild.roles.create({
        name: roleDef.name,
        permissions: [],
        reason: 'tomichu self-role template (color fallback)',
        ...fallback,
      });
    }
    throw err;
  }
}

async function ensureRolesForSection(guild, section) {
  const results = [];
  for (const roleDef of section.roles) {
    const role = await ensureRole(guild, roleDef);
    results.push({ roleDef, role });
    await sleep(ROLE_ACTION_DELAY_MS);
  }
  return results;
}

// Builds and sends one self-role message from a template: creates any
// missing roles, builds the embed (with a role-mention preview) + UI for
// each section, sends it, and writes a registry entry so
// interactions/reactions/undoembed can be resolved later without ever
// re-reading the template.
async function sendTemplate(client, guild, channel, templateId) {
  const template = getTemplate(templateId);
  if (!template) return { ok: false, reason: 'not_found' };

  await ensureAppEmojisLoaded(client);
  // Guilds with many roles can have a stale/partial role cache — same
  // class of bug as the original "only 7 members" nickname issue.
  await guild.roles.fetch();

  const components = [];
  const registrySections = [];
  const previewSections = [];
  const reactionsToAdd = [];

  const sections = template.sections ?? [];

  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
    const section = sections[sectionIndex];
    const rolesWithDefs = await ensureRolesForSection(guild, section);
    const roleIds = rolesWithDefs.map(({ role }) => role.id);

    previewSections.push({
      heading: section.placeholder || section.title || null,
      entries: rolesWithDefs.map(({ roleDef, role }) => ({ emojiKey: roleDef.emoji, roleId: role.id })),
    });

    if (section.interaction === 'reaction') {
      const bindings = {};
      for (const { roleDef, role } of rolesWithDefs) {
        bindings[roleDef.emoji] = role.id;
        reactionsToAdd.push({ key: roleDef.emoji });
      }
      registrySections[sectionIndex] = { interaction: 'reaction', bindings, roleIds };
    } else if (section.interaction === 'dropdown') {
      const options = rolesWithDefs.map(({ roleDef, role }) => ({
        label: roleDef.name,
        value: role.id,
        emoji: emojiIdentifier(resolveEmojiKey(client, roleDef.emoji)),
      }));

      const select = new StringSelectMenuBuilder()
        .setCustomId(`selfrole:sel:${sectionIndex}`)
        .setPlaceholder(section.placeholder || 'Select a role')
        .setMinValues(0)
        .setMaxValues(options.length)
        .addOptions(options);

      components.push(new ActionRowBuilder().addComponents(select));
      registrySections[sectionIndex] = { interaction: 'dropdown', roleIds };
    } else if (section.interaction === 'buttons') {
      const buttons = rolesWithDefs.map(({ roleDef, role }) =>
        new ButtonBuilder()
          .setCustomId(`selfrole:btn:${role.id}`)
          .setLabel(roleDef.name)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(emojiIdentifier(resolveEmojiKey(client, roleDef.emoji))),
      );

      // Discord caps buttons at 5 per row.
      for (let i = 0; i < buttons.length; i += 5) {
        components.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
      }
      registrySections[sectionIndex] = { interaction: 'buttons', roleIds };
    }
  }

  const embed = buildEmbed(client, template, previewSections);
  const message = await channel.send({ embeds: [embed], components });

  for (const { key } of reactionsToAdd) {
    const identifier = emojiReactionIdentifier(resolveEmojiKey(client, key));
    try {
      await message.react(identifier);
    } catch (err) {
      console.warn(`Could not react with ${identifier}:`, err.message);
    }
    await sleep(REACTION_DELAY_MS);
  }

  await addMessage(message.id, {
    guildId: guild.id,
    channelId: channel.id,
    templateId: template.id,
    sections: registrySections,
  });

  const roleCount = registrySections.reduce((total, section) => total + (section.roleIds?.length ?? 0), 0);

  return { ok: true, message, roleCount };
}

async function toggleSelfRole(member, roleId) {
  const has = member.roles.cache.has(roleId);
  try {
    if (has) {
      await member.roles.remove(roleId, 'tomichu self-role toggle');
    } else {
      await member.roles.add(roleId, 'tomichu self-role toggle');
    }
    return { added: !has };
  } catch (err) {
    console.error('Failed to toggle self-role:', err);
    return { added: !has, error: err };
  }
}

// Buttons encode the role ID directly in their customId
// (selfrole:btn:<roleId>) — fully stateless, no registry lookup needed.
async function handleButtonInteraction(interaction) {
  const roleId = interaction.customId.split(':')[2];
  const { added, error } = await toggleSelfRole(interaction.member, roleId);

  if (error) {
    return interaction.reply({
      content: "Couldn't update that role — check my role position and permissions",
      flags: MessageFlags.Ephemeral,
    });
  }

  const role = interaction.guild.roles.cache.get(roleId);
  const text = added ? `Added **${role?.name ?? 'role'}**` : `Removed **${role?.name ?? 'role'}**`;
  return interaction.reply({ content: text, flags: MessageFlags.Ephemeral });
}

// Select menus need the full option set to know what to remove on
// deselect — that comes from the registry, keyed by message + section
// index, not from the interaction itself.
async function handleSelectInteraction(interaction) {
  const sectionIndex = Number(interaction.customId.split(':')[2]);
  const entry = getMessage(interaction.message.id);
  const section = entry?.sections?.[sectionIndex];

  if (!section?.roleIds) {
    return interaction.reply({
      content: "This role menu isn't tracked anymore — ask a mod to resend it",
      flags: MessageFlags.Ephemeral,
    });
  }

  const selected = new Set(interaction.values);
  const member = interaction.member;
  const toAdd = section.roleIds.filter((id) => selected.has(id) && !member.roles.cache.has(id));
  const toRemove = section.roleIds.filter((id) => !selected.has(id) && member.roles.cache.has(id));

  try {
    if (toAdd.length) await member.roles.add(toAdd, 'tomichu self-role dropdown');
    if (toRemove.length) await member.roles.remove(toRemove, 'tomichu self-role dropdown');
  } catch (err) {
    console.error('Failed to update roles from select menu:', err);
    return interaction.reply({
      content: "Couldn't update your roles — check my role position and permissions",
      flags: MessageFlags.Ephemeral,
    });
  }

  return interaction.reply({ content: 'Roles updated', flags: MessageFlags.Ephemeral });
}

// Reactions carry no data of their own — messageId + emoji is looked up
// in the registry to find the bound role.
async function handleReactionAdd(reaction, user) {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch().catch(() => null);
  if (reaction.message.partial) await reaction.message.fetch().catch(() => null);

  const entry = getMessage(reaction.message.id);
  if (!entry) return;

  const roleId = entry.sections.find((s) => s.interaction === 'reaction')?.bindings?.[reaction.emoji.name];
  if (!roleId) return;

  const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
  if (!member) return;

  await member.roles.add(roleId, 'tomichu self-role reaction').catch((err) => console.error('Failed to add reaction role:', err));
}

async function handleReactionRemove(reaction, user) {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch().catch(() => null);
  if (reaction.message.partial) await reaction.message.fetch().catch(() => null);

  const entry = getMessage(reaction.message.id);
  if (!entry) return;

  const roleId = entry.sections.find((s) => s.interaction === 'reaction')?.bindings?.[reaction.emoji.name];
  if (!roleId) return;

  const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
  if (!member) return;

  await member.roles.remove(roleId, 'tomichu self-role reaction').catch((err) => console.error('Failed to remove reaction role:', err));
}

module.exports = {
  sendTemplate,
  handleButtonInteraction,
  handleSelectInteraction,
  handleReactionAdd,
  handleReactionRemove,
};
