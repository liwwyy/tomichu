# tomichu

Bulk-nickname + message utility bot. Built to sit alongside stain (same `,`
prefix) without stepping on its commands.

## Setup

```
npm install
cp .env.example .env   # fill in DISCORD_TOKEN and DISCORD_CLIENT_ID
npm run deploy          # registers slash commands with Discord (run once, or after changing any)
npm start
```

The bot needs the `Manage Nicknames` permission for the nick commands,
`Manage Webhooks` for `,say` / `/say` to send impersonated messages, and
`Manage Messages` for `,say` to delete the original command message
afterward. If `Manage Messages` is missing, the impersonated message
still sends fine, but the original `,say` message stays and a warning is
logged to the console.

## Structure

```
src/
  index.js                entry point, wires everything together
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
  features/uwulock.js          tracks locked users per guild + the intercept/webhook/delete flow
  commands/                   prefix commands, auto-loaded by commands/index.js
  slashCommands/              slash commands, auto-loaded by slashCommands/index.js
  doubleCommands/              ,, (double-comma) commands: help, ping — auto-loaded by doubleCommands/index.js
  handlers/messageCreate.js   prefix parsing + command dispatch (both , and ,,)
  handlers/interactionCreate.js   slash command dispatch
deploy-commands.js         registers slash commands with Discord (npm run deploy)
```

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

### Fun
- `,bra` — random cup-size embed, just for fun
- `,uwulock @member` / `,uwu @member` — toggle uwu-lock on a member: while locked, their future messages get uwuified and resent as them via webhook, original deleted. Running it again on an already-locked member removes the lock.
- `,uwulock remove @member` / `,uwu remove @member` — explicitly remove a member's uwu-lock
- `,uwuclear` — clear every uwu-lock in the server

The uwulock commands require the `Manage Messages` permission to use, since they act on someone else's messages. Locks are in-memory per guild and reset if the bot restarts.

### Blank templates for new Fun commands

`src/commands/_templates/` has three ready-to-edit stub files
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
