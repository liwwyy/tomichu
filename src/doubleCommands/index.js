const fs = require('fs');
const path = require('path');

function loadDoubleCommands() {
  const commands = new Map();
  const dir = __dirname;

  for (const file of fs.readdirSync(dir)) {
    if (file === 'index.js' || !file.endsWith('.js')) continue;
    const command = require(path.join(dir, file));
    if (command?.name && typeof command.execute === 'function') {
      commands.set(command.name, command);
    }
  }

  return commands;
}

module.exports = { loadDoubleCommands };
