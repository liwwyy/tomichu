const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
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

// --- Legacy (embed-based) layout -------------------------------------

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

function buildLegacyPayload(client, template, sectionsWithRoles) {
  const components = [];
  const previewSections = [];

  for (const { section, rolesWithDefs, sectionIndex } of sectionsWithRoles) {
    previewSections.push({
      heading: section.placeholder || section.title || null,
      entries: rolesWithDefs.map(({ roleDef, role }) => ({ emojiKey: roleDef.emoji, roleId: role.id })),
    });

    if (section.interaction === 'dropdown') {
      const exclusive = Boolean(section.exclusive);
      const options = rolesWithDefs.map(({ roleDef, role }) => {
        const option = { label: roleDef.name, value: role.id };
        if (roleDef.emoji) option.emoji = emojiIdentifier(resolveEmojiKey(client, roleDef.emoji));
        return option;
      });

      const select = new StringSelectMenuBuilder()
        .setCustomId(`selfrole:sel:${sectionIndex}`)
        .setPlaceholder(section.placeholder || 'Select a role')
        .setMinValues(exclusive ? 1 : 0)
        .setMaxValues(exclusive ? 1 : options.length)
        .addOptions(options);

      components.push(new ActionRowBuilder().addComponents(select));
    } else if (section.interaction === 'buttons') {
      const buttons = rolesWithDefs.map(({ roleDef, role }) => {
        const button = new ButtonBuilder().setCustomId(`selfrole:btn:${role.id}`).setLabel(roleDef.name).setStyle(ButtonStyle.Secondary);
        if (roleDef.emoji) button.setEmoji(emojiIdentifier(resolveEmojiKey(client, roleDef.emoji)));
        return button;
      });

      for (let i = 0; i < buttons.length; i += 5) {
        components.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
      }
    }
  }

  return { embeds: [buildEmbed(client, template, previewSections)], components };
}

// --- Components V2 layout ---------------------------------------------
// A Container-based card: a heading, a plain role-mention preview block
// per section (no emoji, no indent — just <@&role> per line), then each
// interactive element re-labeled with its own heading. Discord requires
// content/embeds/poll/stickers to be entirely unset when using this.
function buildComponentsV2Payload(client, template, sectionsWithRoles) {
  const container = new ContainerBuilder();
  const e = template.embed ?? {};
  const divider = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

  if (e.title) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${e.title}`));
    container.addSeparatorComponents(divider());
  }

  for (const { section, rolesWithDefs } of sectionsWithRoles) {
    const heading = section.placeholder || section.title;
    const headingLine = heading ? `**${heading}**\n` : '';
    const mentions = rolesWithDefs.map(({ role }) => `<@&${role.id}>`).join('\n');
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(headingLine + mentions));
    container.addSeparatorComponents(divider());
  }

  const interactiveSections = sectionsWithRoles.filter(({ section }) => section.interaction !== 'reaction');

  interactiveSections.forEach(({ section, rolesWithDefs, sectionIndex }, index) => {
    const heading = section.placeholder || section.title || 'Select a role';

    if (section.interaction === 'dropdown') {
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${heading}**`));

      const exclusive = Boolean(section.exclusive);
      const options = rolesWithDefs.map(({ roleDef, role }) => {
        const option = { label: roleDef.name, value: role.id };
        if (roleDef.emoji) option.emoji = emojiIdentifier(resolveEmojiKey(client, roleDef.emoji));
        return option;
      });

      const select = new StringSelectMenuBuilder()
        .setCustomId(`selfrole:sel:${sectionIndex}`)
        .setPlaceholder(heading)
        .setMinValues(exclusive ? 1 : 0)
        .setMaxValues(exclusive ? 1 : options.length)
        .addOptions(options);

      container.addActionRowComponents(new ActionRowBuilder().addComponents(select));
    } else if (section.interaction === 'buttons') {
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${heading}**`));

      const buttons = rolesWithDefs.map(({ roleDef, role }) => {
        const button = new ButtonBuilder().setCustomId(`selfrole:btn:${role.id}`).setLabel(roleDef.name).setStyle(ButtonStyle.Secondary);
        if (roleDef.emoji) button.setEmoji(emojiIdentifier(resolveEmojiKey(client, roleDef.emoji)));
        return button;
      });

      for (let i = 0; i < buttons.length; i += 5) {
        container.addActionRowComponents(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
      }
    }

    if (index < interactiveSections.length - 1) {
      container.addSeparatorComponents(divider());
    }
  });

  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

// --- Role creation -----------------------------------------------------

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

// --- Send -----------------------------------------------------------

// Builds and sends one self-role message from a template: creates any
// missing roles, builds the embed/container + UI for each section,
// sends it, and writes a registry entry so interactions/reactions/
// undoembed can be resolved later without ever re-reading the template.
async function sendTemplate(client, guild, channel, templateId) {
  const template = getTemplate(templateId);
  if (!template) return { ok: false, reason: 'not_found' };

  await ensureAppEmojisLoaded(client);
  // Guilds with many roles can have a stale/partial role cache — same
  // class of bug as the original "only 7 members" nickname issue.
  await guild.roles.fetch();

  const registrySections = [];
  const sectionsWithRoles = [];
  const reactionsToAdd = [];

  const sections = template.sections ?? [];

  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
    const section = sections[sectionIndex];
    const rolesWithDefs = await ensureRolesForSection(guild, section);
    const roleIds = rolesWithDefs.map(({ role }) => role.id);
    const exclusive = Boolean(section.exclusive);

    sectionsWithRoles.push({ section, rolesWithDefs, sectionIndex });

    if (section.interaction === 'reaction') {
      const bindings = {};
      for (const { roleDef, role } of rolesWithDefs) {
        bindings[roleDef.emoji] = role.id;
        reactionsToAdd.push({ key: roleDef.emoji });
      }
      registrySections[sectionIndex] = { interaction: 'reaction', bindings, roleIds, exclusive };
    } else if (section.interaction === 'dropdown') {
      registrySections[sectionIndex] = { interaction: 'dropdown', roleIds, exclusive };
    } else if (section.interaction === 'buttons') {
      registrySections[sectionIndex] = { interaction: 'buttons', roleIds, exclusive };
    }
  }

  const payload = template.componentsV2
    ? buildComponentsV2Payload(client, template, sectionsWithRoles)
    : buildLegacyPayload(client, template, sectionsWithRoles);

  const message = await channel.send(payload);

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

// --- Interaction handlers ---------------------------------------------

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
// (selfrole:btn:<roleId>) — a registry lookup is still needed to know
// whether this button belongs to an "exclusive" section, and if so,
// which sibling roles to remove on select.
async function handleButtonInteraction(interaction) {
  const roleId = interaction.customId.split(':')[2];
  const entry = getMessage(interaction.message.id);
  const section = entry?.sections?.find((s) => s.interaction === 'buttons' && s.roleIds?.includes(roleId));

  const member = interaction.member;
  const has = member.roles.cache.has(roleId);

  try {
    if (has) {
      await member.roles.remove(roleId, 'tomichu self-role toggle');
    } else {
      if (section?.exclusive) {
        const siblings = section.roleIds.filter((id) => id !== roleId && member.roles.cache.has(id));
        if (siblings.length) await member.roles.remove(siblings, 'tomichu self-role exclusive switch');
      }
      await member.roles.add(roleId, 'tomichu self-role toggle');
    }
  } catch (err) {
    console.error('Failed to toggle self-role button:', err);
    return interaction.reply({
      content: "Couldn't update that role — check my role position and permissions",
      flags: MessageFlags.Ephemeral,
    });
  }

  const role = interaction.guild.roles.cache.get(roleId);
  const text = has ? `Removed **${role?.name ?? 'role'}**` : `Added **${role?.name ?? 'role'}**`;
  return interaction.reply({ content: text, flags: MessageFlags.Ephemeral });
}

// Select menus need the full option set to know what to remove on
// deselect — that comes from the registry, keyed by message + section
// index, not from the interaction itself. Exclusive sections already
// have minValues/maxValues locked to 1 at build time, so this same diff
// logic naturally handles the single-select "switch" behavior too.
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
// in the registry to find the bound role. For exclusive sections, adding
// a new reaction also removes whatever sibling role (and its reaction)
// the member already had from the same section, so it behaves like a
// toggle/switch rather than letting reactions stack up.
async function handleReactionAdd(reaction, user) {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch().catch(() => null);
  if (reaction.message.partial) await reaction.message.fetch().catch(() => null);

  const entry = getMessage(reaction.message.id);
  if (!entry) return;

  const section = entry.sections.find((s) => s.interaction === 'reaction' && s.bindings?.[reaction.emoji.name]);
  if (!section) return;

  const roleId = section.bindings[reaction.emoji.name];

  const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
  if (!member) return;

  if (section.exclusive) {
    const siblingEntries = Object.entries(section.bindings).filter(
      ([, siblingRoleId]) => siblingRoleId !== roleId && member.roles.cache.has(siblingRoleId),
    );

    for (const [emojiKey, oldRoleId] of siblingEntries) {
      await member.roles.remove(oldRoleId, 'tomichu self-role exclusive switch').catch((err) => console.error('Failed to remove old exclusive role:', err));

      const oldReaction = reaction.message.reactions.cache.find((r) => r.emoji.name === emojiKey);
      if (oldReaction) {
        await oldReaction.users.remove(user.id).catch((err) => console.error('Failed to remove old reaction:', err));
      }
    }
  }

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
