const fs = require('fs');
const path = require('path');

// Auto-loads every command module in this folder into a name -> command
// map, so adding a new feature later just means dropping a new file in
// here — no need to touch this file or index.js.
function loadCommands() {
  const commands = new Map();
  const dir = __dirname;

  for (const file of fs.readdirSync(dir)) {
    if (file === 'index.js' || !file.endsWith('.js')) continue;
    const command = require(path.join(dir, file));
    if (command?.name && typeof command.execute === 'function') {
      commands.set(command.name, command);
      for (const alias of command.aliases || []) {
        commands.set(alias, command);
      }
    }
  }

  return commands;
}

module.exports = { loadCommands };
