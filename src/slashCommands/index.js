const fs = require('fs');
const path = require('path');

function loadSlashCommands() {
  const commands = new Map();
  const dir = __dirname;

  for (const file of fs.readdirSync(dir)) {
    if (file === 'index.js' || !file.endsWith('.js')) continue;
    const command = require(path.join(dir, file));
    if (command?.data && typeof command.execute === 'function') {
      commands.set(command.data.name, command);
    }
  }

  return commands;
}

module.exports = { loadSlashCommands };
