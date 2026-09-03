// Build step for the self-role template showcase site.
//
// Reads every *.json template from ../templates (the bot's shared source
// of truth), copies them into this project's own public/ output so
// Vercel can actually serve them, and generates a plain index.html
// listing each template's id, title, and section count.
//
// No framework, no dependencies — deliberately simple so there's nothing
// to break between now and when this gets fleshed out properly.

const fs = require('fs');
const path = require('path');

const TEMPLATES_SRC = path.join(__dirname, '..', 'templates');
const PUBLIC_DIR = path.join(__dirname, 'public');
const PUBLIC_TEMPLATES_DIR = path.join(PUBLIC_DIR, 'templates');

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

function main() {
  fs.rmSync(PUBLIC_DIR, { recursive: true, force: true });
  fs.mkdirSync(PUBLIC_TEMPLATES_DIR, { recursive: true });

  const files = fs.readdirSync(TEMPLATES_SRC).filter((f) => f.endsWith('.json'));
  const templates = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(TEMPLATES_SRC, file), 'utf8');
    fs.writeFileSync(path.join(PUBLIC_TEMPLATES_DIR, file), raw);

    const data = JSON.parse(raw);
    const sectionCount = data.sections?.length ?? 0;
    const interactionTypes = [...new Set((data.sections ?? []).map((s) => s.interaction))].join(', ');

    templates.push({
      id: data.id,
      title: data.embed?.title ?? data.id,
      sectionCount,
      interactionTypes,
      file,
    });
  }

  const rows = templates
    .map(
      (t) => `
      <tr>
        <td><code>${escapeHtml(t.id)}</code></td>
        <td>${escapeHtml(t.title)}</td>
        <td>${escapeHtml(t.interactionTypes)}</td>
        <td>${t.sectionCount}</td>
        <td><a href="templates/${encodeURIComponent(t.file)}">JSON</a></td>
      </tr>`,
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>tomichu — self-role templates</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f1115; color: #e5e7eb; margin: 0; padding: 2.5rem; }
    h1 { font-weight: 600; }
    p { color: #9ca3af; }
    table { width: 100%; border-collapse: collapse; margin-top: 1.5rem; }
    th, td { text-align: left; padding: 0.6rem 0.8rem; border-bottom: 1px solid #262a33; }
    th { color: #9ca3af; font-weight: 500; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.03em; }
    code { background: #1a1d24; padding: 0.15rem 0.4rem; border-radius: 4px; }
    a { color: #8ab4ff; }
  </style>
</head>
<body>
  <h1>tomichu self-role templates</h1>
  <p>Run <code>,sendembed &lt;id&gt;</code> in Discord with one of the IDs below.</p>
  <table>
    <thead>
      <tr><th>ID</th><th>Title</th><th>Interaction</th><th>Sections</th><th></th></tr>
    </thead>
    <tbody>${rows}
    </tbody>
  </table>
</body>
</html>
`;

  fs.writeFileSync(path.join(PUBLIC_DIR, 'index.html'), html);
  console.log(`Built ${templates.length} template(s) into ${PUBLIC_DIR}`);
}

main();
