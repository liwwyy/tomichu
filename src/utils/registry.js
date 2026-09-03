// The source of truth every interaction/reaction handler reads from at
// click-time — never re-derived from the template. Plain JSON on disk,
// loaded once into memory, written back atomically (write to a .tmp file
// then rename over the real one) through a serialized queue so concurrent
// writes can't corrupt it.

const fs = require('fs');
const path = require('path');

const REGISTRY_PATH = path.join(__dirname, '..', '..', 'data', 'self-role-registry.json');

let cache = null;
let writeQueue = Promise.resolve();

function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  } catch {
    cache = { messages: {} };
  }
  return cache;
}

function persist() {
  writeQueue = writeQueue
    .then(
      () =>
        new Promise((resolve, reject) => {
          fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
          const tmpPath = `${REGISTRY_PATH}.tmp`;
          fs.writeFile(tmpPath, JSON.stringify(cache, null, 2), (err) => {
            if (err) return reject(err);
            fs.rename(tmpPath, REGISTRY_PATH, (renameErr) => (renameErr ? reject(renameErr) : resolve()));
          });
        }),
    )
    .catch((err) => console.error('Failed to persist self-role registry:', err));
  return writeQueue;
}

function addMessage(messageId, entry) {
  const data = load();
  data.messages[messageId] = entry;
  return persist();
}

function getMessage(messageId) {
  return load().messages[messageId] ?? null;
}

function removeMessage(messageId) {
  const data = load();
  if (!data.messages[messageId]) return Promise.resolve(false);
  delete data.messages[messageId];
  return persist().then(() => true);
}

module.exports = { addMessage, getMessage, removeMessage };
