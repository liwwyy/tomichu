const { successEmbed, failEmbed } = require('../utils/embeds');
const { buildUsageEmbed } = require('../utils/commandCard');
const { hasManageRoles, canManageRoles } = require('../utils/permissions');
const { listTemplates } = require('../utils/templates');
const { sendTemplate } = require('../features/selfRoles');

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

    let result;
    try {
      result = await sendTemplate(message.client, message.guild, message.channel, templateId);
    } catch (err) {
      console.error('Error sending self-role template:', err);
      return message.reply({
        embeds: [failEmbed(message.author.id, "Something went wrong — check my `Manage Roles` permission and role position")],
      });
    }

    if (!result.ok) {
      return message.reply({
        content: `Available templates: ${formatAvailable()}`,
        embeds: [failEmbed(message.author.id, `No template with id \`${templateId}\``)],
      });
    }

    return message.reply({
      embeds: [successEmbed(message.author.id, `Sent **${result.roleCount}** role(s) from **${templateId}**`)],
    });
  },
};

module.exports = command;
