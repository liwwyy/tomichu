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
  emojiIdentifier,
  emojiReactionIdentifier,
  substituteEmojiTokens,
} = require('../utils/emojiResolver');

const ROLE_ACTION_DELAY_MS = 350;
const REACTION_DELAY_MS = 350;

// Fixed values Discord requires for the holographic role style — sending
// any tertiaryColor at all forces these exact values regardless of what
// you pass, so a template just says "holographic" and we supply them.
const HOLOGRAPHIC_COLORS = { primaryColor: 11127295, secondaryColor: 16759788, tertiaryColor: 16761760 };

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildEmbed(client, template) {
  const e = template.embed ?? {};
  const embed = new EmbedBuilder();

  if (e.title) embed.setTitle(e.title);
  if (e.color) embed.setColor(e.color);
  if (e.thumbnail) embed.setThumbnail(e.thumbnail);

  const lines = [e.header, e.content, e.divider, e.footer]
    .map((line) => substituteEmojiTokens(client, line))
    .filter((line) => line);

  if (lines.length) embed.setDescription(lines.join('\n'));

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

// Finds an existing role by name, or creates it. Gradient/holographic
// colors require a high enough boost level — if that fails, falls back
// to a solid color so the role (and the rest of the template) still goes
// out instead of hard-failing the whole command.
async function ensureRole(guild, roleDef) {
  const existing = guild.roles.cache.find((role) => role.name === roleDef.name);
  if (existing) return existing;

  const colorOptions = resolveRoleColorOptions(roleDef);

  try {
    return await guild.roles.create({ name: roleDef.name, reason: 'tomichu self-role template', ...colorOptions });
  } catch (err) {
    if (colorOptions.colors) {
      console.warn(`Falling back to solid color for role "${roleDef.name}" (likely insufficient boost level):`, err.message);
      const fallback = roleDef.primary ? { color: roleDef.primary } : {};
      return guild.roles.create({
        name: roleDef.name,
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
// missing roles, builds the embed + UI for each section, sends it, and
// writes a registry entry so interactions/reactions can be resolved
// later without ever re-reading the template.
async function sendTemplate(client, guild, channel, templateId) {
  const template = getTemplate(templateId);
  if (!template) return { ok: false, reason: 'not_found' };

  await ensureAppEmojisLoaded(client);

  const embed = buildEmbed(client, template);
  const components = [];
  const registrySections = [];
  const reactionsToAdd = [];

  const sections = template.sections ?? [];

  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
    const section = sections[sectionIndex];

    if (section.interaction === 'reaction') {
      const rolesWithDefs = await ensureRolesForSection(guild, section);
      const bindings = {};
      for (const { roleDef, role } of rolesWithDefs) {
        bindings[roleDef.emoji] = role.id;
        reactionsToAdd.push({ key: roleDef.emoji });
      }
      registrySections[sectionIndex] = { interaction: 'reaction', bindings };
    } else if (section.interaction === 'dropdown') {
      const rolesWithDefs = await ensureRolesForSection(guild, section);
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
      registrySections[sectionIndex] = { interaction: 'dropdown', roleIds: rolesWithDefs.map(({ role }) => role.id) };
    } else if (section.interaction === 'buttons') {
      const rolesWithDefs = await ensureRolesForSection(guild, section);
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
      registrySections[sectionIndex] = { interaction: 'buttons' };
    }
  }

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

  const roleCount = registrySections.reduce((total, section) => {
    if (section.bindings) return total + Object.keys(section.bindings).length;
    if (section.roleIds) return total + section.roleIds.length;
    return total;
  }, 0);

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
