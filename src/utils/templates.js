const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '..', '..', 'templates');

function listTemplateFiles() {
  if (!fs.existsSync(TEMPLATES_DIR)) return [];
  return fs.readdirSync(TEMPLATES_DIR).filter((file) => file.endsWith('.json'));
}

function readTemplate(file) {
  return JSON.parse(fs.readFileSync(path.join(TEMPLATES_DIR, file), 'utf8'));
}

function getTemplate(id) {
  for (const file of listTemplateFiles()) {
    const data = readTemplate(file);
    if (data.id === id) return data;
  }
  return null;
}

// Lightweight list for usage/error messages — just id + title, not the
// full role data.
function listTemplates() {
  return listTemplateFiles().map((file) => {
    const data = readTemplate(file);
    return { id: data.id, title: data.embed?.title ?? data.id };
  });
}

module.exports = { getTemplate, listTemplates };
