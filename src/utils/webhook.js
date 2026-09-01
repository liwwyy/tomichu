const WEBHOOK_NAME = 'tomichu-webhook';

// Keyed by the text channel's ID (thread parent if it's a thread).
const webhookCache = new Map();

function resolveWebhookChannel(channel) {
  return channel.isThread() ? channel.parent : channel;
}

async function getWebhook(channel) {
  const target = resolveWebhookChannel(channel);
  if (!target) throw new Error('This channel type does not support webhooks');

  const cached = webhookCache.get(target.id);
  if (cached) return cached;

  const webhooks = await target.fetchWebhooks();
  let webhook = webhooks.find((wh) => wh.owner?.id === target.client.user.id && wh.name === WEBHOOK_NAME);

  if (!webhook) {
    webhook = await target.createWebhook({ name: WEBHOOK_NAME });
  }

  webhookCache.set(target.id, webhook);
  return webhook;
}

// Sends a webhook message styled as the given guild member:
// username "{display name} (@{username})", server/guild avatar.
async function sendAsUser(channel, member, payload) {
  const webhook = await getWebhook(channel);
  const threadId = channel.isThread() ? channel.id : undefined;

  return webhook.send({
    ...payload,
    username: `${member.displayName} (@${member.user.username})`,
    avatarURL: member.displayAvatarURL({ extension: 'png', size: 256 }),
    threadId,
  });
}

module.exports = { getWebhook, sendAsUser };
