# Self-role template schema

This is the data format `,sendembed <template_id>` reads from — live and
wired into the bot.

## Top-level template

```json
{
  "id": "pronouns-goth",
  "componentsV2": false,   // optional, defaults to false — see layout section below
  "exclusiveAcrossSections": false,  // optional, defaults to false — see below
  "embed": { ... },         // one embed for the whole message — see below
  "sections": [ ... ]        // one or more interaction groups — see below
}
```

- **One template = one Discord message.** A template's `sections` array
  describes every interactive element attached to that single message.
- **Reactions**: a template with a reaction section is meant to hold
  exactly one section — reactions all land on one message with no visual
  grouping, so mixing topics in one reaction message gets confusing fast.
- **Dropdowns**: a template can hold up to 5 dropdown sections (Discord's
  cap on action rows per message), each rendered as its own select menu.
- **`exclusiveAcrossSections`** — when `true`, every section marked
  `exclusive: true` in this template shares **one combined pool** instead
  of each staying scoped to its own section. Concretely: picking a role
  from Rainbow in `gradient-palettes-goth` removes any role the member
  already had from Exotic (and vice versa), since both sections opt into
  this. Leave it `false`/absent (the default) and each exclusive section
  stays independent — picking a role in one never touches another. This
  works identically across dropdowns, buttons, and reactions, and mixes
  freely between them (e.g. an exclusive dropdown and an exclusive
  reaction section in the same template can evict each other's roles).

## Two layouts

### Legacy (default) — traditional embed

Used when `componentsV2` is absent or `false`. The embed's description is
built from `header` / `content` / `footer` plus an auto-generated,
indented, emoji-prefixed role-mention block per section. This is what
`pronouns-goth.json`, `fun-goth.json`, `age-goth.json`, and
`dm-status-goth.json` use.

### Components V2 — card layout

Used when `componentsV2: true`. Instead of an embed, the message is built
as a single `ContainerBuilder` card: an optional `header` line, a
`### {embed.title}` heading, then one plain role-mention block per
section (**no emoji, no indent** — just `<@&roleId>` one per line), then
each interactive element re-labeled with its own bold heading right
above its select menu/buttons, an optional `footer` line at the very
bottom, separated by dividers throughout. This is what
`gradient-palettes-goth.json`, `alt-mix.json`, `alt-mix-2.json`, and
`all-colors.json` use. `header` and
`footer` work exactly like the legacy layout (same `{token}` emoji
substitution) — only `content`/`color`/`thumbnail` don't apply, since
Components V2 messages can't carry a regular embed at all (Discord
requires content/embeds/poll/stickers to be entirely unset when the
`IsComponentsV2` flag is set).

## `embed` block (legacy layout only)

```json
{
  "title": "Pronouns",
  "content": "",
  "header": "₊˚ ✧ ━━━━ ꒰ঌ ⊱ · {wings_t} · ⊰ ໒꒱ ━━━━ ✧ ₊˚",
  "footer": "₊˚ ✧ ━━━━ ꒰ঌ ⊱ · {star_t} · ⊰ ໒꒱ ━━━━ ✧ ₊˚",
  "divider": "",
  "color": null,
  "thumbnail": null
}
```

- `{wings_t}` / `{star_t}` — placeholder tokens for decorative emoji,
  substituted at send-time by looking up that name in
  `client.application.emojis.cache` and swapping in the real
  `<:name:id>` markdown. Never hardcode a snowflake ID in a template —
  emoji IDs are per-bot, so a hardcoded ID from any other bot (including
  your old one) will just render as broken text.
- `content` — optional extra line, rarely needed now since `title` plus
  the auto-generated role-mention list (below) covers what it used to.
  Leave it `""` unless you specifically want an extra line right after
  the header.
- `color` — the **embed's** side-color (a hex string or null), unrelated
  to any role color.
- `thumbnail` — optional image URL, `null` if unused.

**The role-mention preview is generated automatically in both layouts**
— you never write it into the template. For every section, the bot
builds one line per role using the real role ID created for that role.
If a template has more than one section, each block gets a bold heading
from that section's `placeholder`/`title` so a multi-dropdown message
reads as clearly labeled groups instead of one long undifferentiated
list.

## `sections[]`

Each section is one interactive group attached to the message.

- `exclusive` (optional, any interaction type, default `false`) — when
  `true`, the section behaves like a radio group: selecting a new role
  automatically removes whichever other role from the *same section* the
  member already had (or from *any* exclusive section in the template, if
  the template-level `exclusiveAcrossSections` flag above is also on).
  - **Dropdown**: forces `minValues: 1, maxValues: 1` on the select menu,
    so the UI itself only ever allows one choice.
  - **Buttons**: clicking a button removes any sibling role from the
    same section the member currently holds before adding the new one.
  - **Reactions**: adding a new reaction removes the bound role for
    whichever sibling emoji the member already reacted with — *and*
    removes that old reaction from the message itself, so the message
    visually reflects the switch instead of leaving a stale reaction
    behind. When a cross-section removal evicts a role that came from a
    *different* section (a dropdown or button section, say), only the
    role itself is removed — there's no reaction or persistent UI state
    on those to clean up.
  - Non-exclusive sections are untouched by any of this — multiple roles
    from the same section can be held at once, exactly like before.

### Reaction section

```json
{
  "type": "info",
  "interaction": "reaction",
  "exclusive": false,
  "roles": [
    { "emoji": "1_", "name": "she/her" },
    { "emoji": "2_", "name": "he/him" },
    { "emoji": "3_", "name": "they/them" },
    { "emoji": "4_", "name": "any/all" }
  ]
}
```

- `roles[].emoji` — app-emoji **name** (resolved the same way as the
  header/footer tokens) or a plain unicode emoji. Reaction-role sections
  cap out around 9 options in practice — that's exactly why you've got
  `1_` through `9_` uploaded.

### Dropdown section

```json
{
  "type": "color",
  "interaction": "dropdown",
  "placeholder": "Rainbow",
  "exclusive": true,
  "roles": [
    {
      "name": "❤️ Red",
      "colorType": "gradient",
      "primary": "#FFB3B3",
      "secondary": "#FF8080"
    }
  ]
}
```

`roles[].emoji` is optional here — the gradient-palettes template instead
bakes the emoji straight into `name` (e.g. `"❤️ Red"`), which becomes
both the select option's label *and* the actual created role's name. If
`emoji` **is** set, it's used as a separate select-option emoji instead
(same resolution as reactions/header tokens) and the role name stays
plain.

`roles[].colorType` is one of:

| colorType     | fields used                  | notes                                                                 |
|---------------|-------------------------------|------------------------------------------------------------------------|
| `solid`       | `primary`                     | plain single-color role                                               |
| `gradient`    | `primary`, `secondary`        | two-color gradient between the given hex values                       |
| `holographic` | *(none — values are fixed)*   | Discord forces `#A9C9FF / #FFBBEC / #FFC3A0` the instant a tertiary color is sent — a template just needs to say "holographic," the bot supplies the real values. **Requires the guild to be boosted enough for enhanced role colors** — worth a graceful error message if role creation 403s. |

## Interaction handling (for later)

Every emoji/button/select-value the bot ever hands out is resolved
straight from a persisted `data/self-role-registry.json` entry, never
re-derived from the template at click-time. Templates are just the "what
to build," the registry is the "what's actually live."

## Role creation rules

- **Reuse over duplication**: before creating any role, tomichu checks
  for an existing role with the same name (case-insensitive) and reuses
  it instead of creating a duplicate.
- **Zero permissions, always**: every role tomichu creates gets an
  explicit empty permission set. Omitting the `permissions` field when
  creating a role causes Discord's API to silently copy whatever
  `@everyone` currently has onto the new role — a well-known footgun this
  sidesteps entirely.
