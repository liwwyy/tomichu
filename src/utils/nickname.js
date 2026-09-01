// Delay between each nickname change in a bulk operation. Discord's
// PATCH member endpoint is rate limited per-guild, so firing requests
// back-to-back in a tight loop will start failing partway through.
const DELAY_MS = 350;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Sets one member's nickname, retrying on 429s using the retry_after
// Discord gives us instead of just giving up.
async function setNicknameSafe(member, nickname, { retries = 3 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await member.setNickname(nickname);
      return { success: true };
    } catch (err) {
      const retryAfterSec = err?.retry_after ?? err?.rawError?.retry_after;
      if (err?.status === 429 && retryAfterSec) {
        await sleep(retryAfterSec * 1000 + 250);
        continue;
      }
      return { success: false, error: err };
    }
  }
  return { success: false, error: new Error('Rate limited after max retries') };
}

async function bulkSetNicknames(members, nickname, { delayMs = DELAY_MS } = {}) {
  let success = 0;
  let failed = 0;
  const failedIds = [];

  for (const member of members) {
    const result = await setNicknameSafe(member, nickname);
    if (result.success) {
      success++;
    } else {
      failed++;
      failedIds.push(member.id);
    }
    await sleep(delayMs);
  }

  return { success, failed, failedIds };
}

module.exports = { sleep, setNicknameSafe, bulkSetNicknames, DELAY_MS };
