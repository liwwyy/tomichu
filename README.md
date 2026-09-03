# tomichu

Bulk-nickname + message utility bot. Built to sit alongside stain (same `,`
prefix) without stepping on its commands.

## Setup

```
npm install
cp .env.example .env   # fill in DISCORD_TOKEN, DISCORD_CLIENT_ID, and (if using the site) GITHUB_TOKEN
npm run deploy          # registers slash commands with Discord (run once, or after changing any)
npm start
```

`index.js` lives at the repo root (not `src/index.js`) since this bot's
hosting doesn't support a custom entry path — it just runs `node
index.js` from wherever the repo lands.

The bot needs the `Manage Nicknames` permission for the nick commands,
`Manage Webhooks` for `,say` / `/say` to send impersonated messages,
`Manage Messages` for `,say` and uwulock to delete original messages, and
`Manage Roles` (with tomichu's role positioned above whatever it needs to
create/assign) for `,sendembed`. If `Manage Messages` is missing for
`,say`, the impersonated message still sends fine, but the original
message stays and a warning is logged to the console.

For reactions to actually work as roles, tomichu also needs the
`Server Members Intent` and `Message Content Intent` enabled in the
Discord Developer Portal (Bot settings), same as any bot that reads
message content or full member lists.

## Structure

This is a monorepo: the Discord bot and the self-role template showcase
site live in the same repo, but are deployed completely separately (see
Deployment below) and never share dependencies.

```
index.js                  bot entry point — Discord hosting runs this directly
package.json               bot's own dependencies (discord.js, dotenv)
deploy-commands.js         registers slash commands with Discord (npm run deploy)
src/
  config.js                 env/config loading (token, client id, prefixes)
  constants/theme.js         colors + emoji IDs used across all embeds
  utils/embeds.js             embed builders (success/fail/warn/loading/plain)
  utils/commandCard.js        per-command usage card + the ,,help embed
  utils/permissions.js        ManageNicknames check, role-hierarchy check, bot filter
  utils/nickname.js           rate-limit-safe nickname setter (single + bulk)
  utils/presence.js           custom status + "Vibing with N members" activity
  utils/webhook.js            finds/creates tomichu's per-channel webhook, sends impersonated messages
  utils/quoteEmbed.js         builds the "Replying to X" quote embed for ,say
  utils/uwuifier.js           standalone text-mangling engine used by uwulock
  utils/templates.js           loads self-role templates from templates/*.json
  utils/emojiResolver.js       resolves emoji names against tomichu's application emojis
  utils/registry.js            persisted self-role-registry.json (atomic reads/writes)
  utils/roleResolve.js         resolves a role from a mention, ID, or exact name
  features/uwulock.js          tracks locked users per guild + the intercept/webhook/delete flow
  features/selfRoles.js        template -> roles/embed/components, plus all interaction/reaction handlers
  commands/                   prefix commands, auto-loaded by commands/index.js
  slashCommands/              slash commands, auto-loaded by slashCommands/index.js
  doubleCommands/              ,, (double-comma) commands: help, ping — auto-loaded by doubleCommands/index.js
  handlers/messageCreate.js   prefix parsing + command dispatch (both , and ,,)
  handlers/interactionCreate.js   slash command + self-role button/select dispatch
templates/                  self-role template JSON — shared source of truth for the bot AND the website
  SCHEMA.md                   full format reference
  reaction-*.json, dropdown-*.json
data/self-role-registry.json  bot-generated at runtime — never hand-edited, gitignored
website/                    Vercel project root (see Deployment) — its own package.json, isolated deps
  build.js                    copies ../templates/*.json + generates a static showcase page
  vercel.json
  package.json
```

## Deployment

Two independent deploys out of one repo:

**Bot** — your Discord bot host pulls the whole repo and runs `node
index.js` from the root. It never touches `website/` at all; that
folder's dependencies (currently none) stay out of the bot's own
`npm install` since `website/` has its own separate `package.json`.

**Website** — connect this repo to a Vercel project, then in *Project
Settings → Build & Development Settings*:
1. Set **Root Directory** to `website`. This is what actually scopes
   Vercel into that folder — `vercel.json` alone doesn't do this part,
   it only configures the build once Vercel is already pointed there.
2. Enable **"Include source files outside of the Root Directory in the
   Build Step"**. Without this, `website/build.js` can't read
   `../templates/*.json` at build time — Vercel won't check out the rest
   of the repo otherwise.

From there, every push to the repo triggers a Vercel build that copies
the current templates into a fresh static page automatically.

**Keeping templates in sync** — if you want the bot itself to push
template edits (e.g. from an in-Discord admin command later) rather than
hand-editing `templates/*.json` and pushing yourself, it needs a
**fine-grained GitHub PAT** scoped to this one repo with only "Contents:
Read and write" permission, stored as `GITHUB_TOKEN` in `.env`. It'd use
GitHub's Contents API (read the file's current SHA, then `PUT` the new
content) — no local git needed. One trade-off worth knowing since this
is now the same repo as the bot's own source: that token's write access
isn't limited to just `templates/` — GitHub scopes PATs per-repo, not
per-folder — so if it ever leaked, it could touch the bot's code too, not
just template JSON. For a personal project that's a reasonable trade for
the simplicity of one repo; just don't reuse that PAT anywhere else.

## Adding a new command later

**Prefix command** — drop a file in `src/commands/` exporting `{ name,
category, description, usage, example, execute }`:

```js
module.exports = {
  name: 'ping',
  category: 'Utility',
  description: 'Check that tomichu is alive',
  usage: 'ping',
  example: ',ping',
  async execute(message, args) {
    await message.reply('pong');
  },
};
```

**Slash command** — drop a file in `src/slashCommands/` exporting `{ data,
execute }` where `data` is a `SlashCommandBuilder`. Run `npm run deploy`
afterward to register it with Discord.

**Double-prefix (`,,`) command** — drop a file in `src/doubleCommands/`
exporting `{ name, execute(message, { client, commands }) }`.

All three are picked up automatically on startup. Prefix commands also
show up in `,,help` automatically — nothing else to register there.

## Commands

### Bulk Actions
- `,nickallreset` — reset every member's nickname (no arguments needed)
- `,nickall <nickname>` — rename every member to the same nickname (shows a usage card if you leave off the nickname)

Both always ask for confirmation with "Rename all" / "Cancel" buttons
before touching anyone's nickname. Bots are ignored by default. Members
whose top role is equal to or higher than tomichu's, and the server
owner, are skipped since Discord's API won't let the bot touch them
anyway.

### Messages
- `,say <message>` / `/say message:<message> media:<optional attachment> reply_to:<optional message ID>` — sends a webhook message styled as you: username `{display name} (@{username})`, your server avatar.
  - The text version also accepts an attached file/image and deletes your original `,say` message afterward.
  - If you send `,say` as a reply to another message (or pass `reply_to` on `/say` with a message ID), tomichu first posts a small quote embed ("Replying to X") showing what you replied to, then sends your actual message right after — both via the webhook, styled as you.
  - To get a message ID for `reply_to`: enable Developer Mode in Discord settings, then right-click a message → Copy Message ID. Only works for messages in the same channel.
  - **`/say` is user-installable** (`ApplicationIntegrationType.UserInstall` + all three interaction contexts) — it works in DMs, group DMs, and servers tomichu itself isn't a member of. True webhook impersonation is only possible where tomichu actually has a guild channel to create a webhook in; everywhere else it automatically falls back to relaying the message as `**{display name}:** {content}` instead. Run `npm run deploy` after any change to slash command definitions, and users need to add the app to their account (not just a server) from tomichu's profile for this to show up outside servers it's in.

### Fun
- `,bra` — random cup-size embed, just for fun
- ~~`,uwulock @member` / `,uwu @member`~~ — **temporarily disabled** (flip `FEATURE_DISABLED` in `src/features/uwulock.js` back to `false`, and remove `disabled: true` from `src/commands/uwulock.js` + `src/commands/uwuclear.js`, to bring it back)

### Self Roles
- `,sendembed <template_id>` — sends a self-role message built from a template in `templates/`, creating any missing roles first. Run it with no ID to see available template IDs. Requires `Manage Roles` on both you and the bot.
- `,undoembed <message_id>` — deletes every role tracked from that self-role message, edits the message to a plain "undone" notice, clears its reactions, and removes it from the registry. Irreversible.

**How it works:**
- **Role-mention preview** — the embed description always lists every role the message controls as `{emoji}<@&role>`, generated fresh from the actual created role IDs each time — never something you write into the template by hand.
- **Buttons** — each button's role ID is baked straight into its `custom_id`, so clicking one is fully stateless: no lookup needed, survives bot restarts automatically.
- **Dropdowns (select menus)** — up to 5 groups per message, each its own select menu. On selection, the full option set for that menu is read from `data/self-role-registry.json` (keyed by message + section index) to correctly add newly-selected roles and remove deselected ones.
- **Reactions** — a reaction alone can't carry any data, so `messageId + emoji name` is looked up in the same registry to find the bound role. This is why reactions specifically need the `data/self-role-registry.json` file to persist across restarts — buttons/dropdowns are stateless by design, but reactions have no other way to carry that information.
- **Emoji** — every emoji in a template (decorative header/footer tokens like `{wings_t}`, or a role's own emoji like `1_`) is resolved against tomichu's own application emojis (uploaded via the Discord Developer Portal) at send-time. Templates never hardcode a snowflake ID, since those are per-bot and would break the moment a different bot account is used.
- **Role colors** — `colorType: "gradient"` and `"holographic"` need the guild to be boosted enough for Discord's enhanced role colors. If role creation fails for that reason, tomichu automatically retries as a plain solid color instead of failing the whole template, and logs a warning so it's visible why a role isn't gradient/holographic.
- **Reusing roles** — before creating any role (from a template, or from the commands below), tomichu checks for an existing role with the same name (case-insensitive) and reuses it instead of duplicating.
- **Zero permissions** — every role tomichu creates gets an explicit empty permission set. Leaving `permissions` unset makes Discord silently copy whatever `@everyone` currently has onto the new role — this sidesteps that entirely.

### Roles
- `,mkroles <name1, name2, name3>` — creates multiple roles at once from a comma-separated list (max 25 per call), skipping any that already exist by name
- `,delrolesbelow <role>` — deletes every deletable role positioned below the given role, with a confirm/cancel step first
- `,delrolesbetween <role1> <role2>` — deletes every deletable role strictly between two given roles (order doesn't matter), with a confirm/cancel step first

All three require `Manage Roles` on both you and the bot. The delete commands skip anything tomichu can't actually delete (managed/integration roles, roles above tomichu's own) rather than erroring on them — the confirm screen shows the real count of what will actually go.

### Blank templates for new Fun commands
(`fun-placeholder-1.js`, `-2.js`, `-3.js`) with the full field reference
commented at the top. They're **not** live commands — the loader skips
anything that isn't directly inside `src/commands/`. To activate one:
move (or copy) it up into `src/commands/`, fill in `name`, `description`,
and `execute`, then restart the bot.

## Double-prefix commands (`,,`)

Anything under `,,` is its own separate command set from the regular `,`
commands, so `,help` and `,ping` intentionally do nothing — they never
collide with stain's own commands.

- `,,help` — themed embed grouping every regular command by category
- `,,ping` — plain-text latency check (round trip + WebSocket ping), no embed

## Presence

- Custom status: `,,help for welp!`
- Activity: `Vibing with N members` (N = total members across every
  guild tomichu is in), refreshed on join/leave events and every 10
  minutes as a fallback.

## Notes on the two bugs from the original code

1. **"Only ~7 members" bug**: `guild.members.cache` only contains whatever
   members Discord already pushed to the gateway (recently active ones,
   mostly). The fix calls `guild.members.fetch()` before building the
   target list, which pulls the full member list first.
2. **Rate limits during bulk operations**: `utils/nickname.js` adds a small
   delay (350ms) between each nickname change and retries on 429s using the
   `retry_after` Discord returns, instead of letting requests fail silently
   partway through a big batch.
