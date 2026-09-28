# Partner

`apps/bot/src/features/partner/` — partner servers, each announced with a banner: our logo on the
left of `images/partner.png`, theirs drawn onto the right panel.

`default-on`, but nothing is posted until a partner channel is set.

## Commands

All under `/partner`, Manager staff tier and up (score 80). To let a Partner Manager role that
isn't a staff tier use it, grant that role `/partner` with `/command-access`. Slash only — `add`
opens a modal, which the prefix form can't show.

| Subcommand | What it does |
|---|---|
| `channel <channel>` | Where banners are posted. Refused if the bot can't view, send and attach files there. |
| `role <role>` | The role every representative gets. Refused if the bot can't give it (it must sit below the bot's highest role). |
| `add` | Opens the form: invite URL, server name, representative user ID, partner message, partner image (file upload). |
| `list` | Every partner in this server, with its representative, invite and a link to its post. |
| `remove <partner>` | Autocompletes by name. Deletes the partner, its banner post, and the representative's partner role (kept if they still represent another partner). |

## What `add` does

1. Checks the invite actually resolves (`client.fetchInvite`) and warns if it expires.
2. Checks the representative ID is a real Discord user.
3. Checks the upload is an image of at most 8 MB, shrinks it to 512px and keeps that copy — the
   Information panel never depends on the uploader's attachment link staying alive.
4. Renders the banner with `@napi-rs/canvas`: the image is fitted, proportions kept, into a
   rounded square centred on the right panel, the same size as our logo. The banner is posted at
   half the template's size (~2 MB; the full-size PNG is ~8 MB).
5. Posts it, then saves the partner. If the post fails, the partner is not saved.
6. Gives the representative the partner role. If they aren't in the server yet, they get it the
   moment they join (`partner.event.ts`, `guildMemberAdd`) — and again after a rejoin.

Geometry, sizes, emojis and the Be a Partner link are all in `PARTNER_CONFIG`
(`libs/constants/src/partner.ts`).

## The post (Components V2)

One container, no text: the banner full width (media gallery), then two grey buttons.

| Button | Style | Does |
|---|---|---|
| `ℹ️ \| Information` | secondary | Ephemeral panel: name, description, representative, invite, the partner's image, a Join Server link |
| `🤖 \| Be a Partner` | link | Opens `PARTNER_CONFIG.beAPartnerUrl` |

## Data

`PartnerServer` (`partnerservers`): guild, name, invite URL, representative, description, the
stored image, and the post's channel/message ids. Deliberately a new collection — the retired
`Partner` directory is dropped by `scripts/drop-removed-features.ts`, which leaves this one, and
the `partner` feature's settings and command grants, alone.

## Checks

```
bun run test:partner
```

Banner size and scale, image shrinking and rejection, the post's layout and buttons, the
Information panel, the list's 4000-character limit, and the manifest.
