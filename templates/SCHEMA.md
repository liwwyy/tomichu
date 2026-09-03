# Self-role template schema (draft)

This is the data format `,sendembed <template_id>` will read from once
that feature gets built. Nothing here is wired into the bot yet — this is
the schema we settled on in discussion, ready to build against next
version.

## Top-level template

```json
{
  "id": "pronouns-reactions",
  "embed": { ... },      // one embed for the whole message — see below
  "sections": [ ... ]     // one or more interaction groups — see below
}
```

- **One template = one Discord message.** A template's `sections` array
  describes every interactive element attached to that single message.
- **Reactions**: a template with a reaction section is meant to hold
  exactly one section — reactions all land on one embed with no visual
  grouping, so mixing topics in one reaction message gets confusing fast.
- **Dropdowns**: a template can hold up to 5 dropdown sections (Discord's
  cap on action rows per message), each rendered as its own select menu
  under the shared embed. This is why your gradient-palettes file's three
  tone groups collapse into one template with 3 sections instead of 3
  separate templates.

## `embed` block (shared across the whole message)

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

**The role-mention preview is generated automatically** — you never write
it into the template. For every section, the bot builds one line per role
as `{indent}{emoji}<@&roleId>` (using the real role ID created for that
role), and inserts the whole block between the header and footer. If a
template has more than one section, each block gets a bold heading from
that section's `placeholder`/`title` so a multi-dropdown message (like
the gradient palette one) reads as clearly labeled groups instead of one
long undifferentiated list.

## `sections[]`

Each section is one interactive group attached to the shared embed.

### Reaction section

```json
{
  "type": "info",
  "interaction": "reaction",
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
  "placeholder": "Cool Tones",
  "roles": [
    {
      "emoji": "💜",
      "name": "Sovereign Indigo",
      "colorType": "gradient",
      "primary": "#2D0057",
      "secondary": "#6A0DAD"
    }
  ]
}
```

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
