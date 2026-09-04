const { successEmbed, failEmbed, loadingEmbed } = require('../utils/embeds');
const { buildUsageEmbed } = require('../utils/commandCard');
const { hasManageRoles, canManageRoles } = require('../utils/permissions');
const { listTemplates } = require('../utils/templates');
const { sendTemplate } = require('../features/selfRoles');

const CLEANUP_DELAY_MS = 3000;

function formatAvailable() {
  const templates = listTemplates();
  if (!templates.length) return 'none yet — add one to `templates/`';
  return templates.map((t) => `\`${t.id}\``).join(', ');
}

const command = {
  name: 'sendembed',
  category: 'Self Roles',
  description: 'Send a self-role template, creating roles as needed',
  usage: 'sendembed <template_id>',
  example: ',sendembed pronouns-reactions',

  async execute(message, args) {
    if (!hasManageRoles(message.member)) {
      return message.reply({
        embeds: [failEmbed(message.author.id, "You don't have the `Manage Roles` permission to use this command")],
      });
    }

    if (!canManageRoles(message.guild)) {
      return message.reply({
        embeds: [
          failEmbed(
            message.author.id,
            "I need the `Manage Roles` permission (and my role positioned above the ones I'll create) to do this",
          ),
        ],
      });
    }

    const templateId = args[0];
    if (!templateId) {
      return message.reply({
        content: `Available templates: ${formatAvailable()}`,
        embeds: [buildUsageEmbed(command)],
      });
    }

    // Instant feedback while role creation (which can take a few seconds
    // for larger templates) runs in the background.
    const statusMessage = await message.reply({ embeds: [loadingEmbed(message.author.id, 'Creating roles')] });

    let result;
    try {
      result = await sendTemplate(message.client, message.guild, message.channel, templateId);
    } catch (err) {
      console.error('Error sending self-role template:', err);
      return statusMessage.edit({
        embeds: [failEmbed(message.author.id, "Something went wrong — check my `Manage Roles` permission and role position")],
      });
    }

    if (!result.ok) {
      return statusMessage.edit({
        content: `Available templates: ${formatAvailable()}`,
        embeds: [failEmbed(message.author.id, `No template with id \`${templateId}\``)],
      });
    }

    await statusMessage.edit({
      embeds: [successEmbed(message.author.id, `Sent **${result.roleCount}** role(s) from **${templateId}**`)],
    });

    // The actual self-role message (sent inside sendTemplate) is the only
    // thing meant to stick around — the command invocation and this
    // status confirmation are just scaffolding, cleaned up shortly after
    // so the channel doesn't accumulate clutter every time this runs.
    setTimeout(() => {
      statusMessage.delete().catch(() => {});
      message.delete().catch(() => {});
    }, CLEANUP_DELAY_MS);
  },
};

module.exports = command;
