# Privacy Policy

_Last updated: 2026-07-21_

MC Launcher is a self-hosted, community-run project. This isn't corporate boilerplate — it describes exactly what the app actually stores and does, so you know what you're agreeing to by using it.

## What we collect

**Account identity.** Signing in uses Microsoft's device-code flow, which verifies your Microsoft/Xbox account and returns your Minecraft UUID and username. We never see your Microsoft password or email — only the Minecraft profile that comes back from that exchange. That UUID and username are what identifies your account everywhere in the app.

**Modpack data.** Pack names/descriptions, mod files you upload, server entries you add, and membership/role records for any pack you own or join.

**Activity.** Actions taken inside a pack (joins, mod changes, role changes, etc.) are logged with your username and timestamp, visible to that pack's owner and editors as an activity feed.

**Reports and moderation records.** If you report a pack or another player, your username and the report content are stored and visible to admins reviewing it. If an account is banned, the reason given is stored alongside it.

**What we don't collect.** No passwords (auth is delegated entirely to Microsoft), no email address, no payment information, no persistent tracking of your IP address. Backend request rate-limiting uses your IP transiently to enforce limits but doesn't log or store it long-term.

## Where it's stored

Everything lives on infrastructure the maintainer runs directly — a self-hosted server for pack/account data and a self-hosted object store for mod files. Nothing is sent to a third-party analytics, ad, or data-broker service. Your session token is cached locally on your own machine, not on the server.

## Who can see what

- **Public packs** are visible to anyone using the app, by design — that's what "public" means when you create or join one.
- **Private packs** are visible only to their members — with one exception: platform admins can view any pack's contents and member list for moderation purposes (e.g. reviewing a report), and can temporarily grant themselves editor access to help fix a pack. This access is always logged in that pack's own activity feed — it is never silent or hidden from the pack's owner.
- **Admins** can additionally see all reports, all bans, and a list of every pack on the platform (name, owner, visibility, member count) for moderation.

## Your data, your control

- You can leave any pack you're a member of, or delete any pack you own, at any time — this permanently removes that pack's mods, members, servers, and activity log.
- You can delete your own account at any time from the app's Account page — no need to contact anyone. This removes your membership from every pack you're in. If you still own any packs, you'll be asked to transfer ownership or delete them first, since deleting your account can't leave a pack ownerless.
- Deleting your account doesn't erase your name from other people's history. If you were part of a pack's activity log, or filed or were named in a report, those entries are kept but anonymized (your name and ID are blanked out) rather than deleted outright — so the pack owner's or admin's records stay intact instead of having holes torn in them.

## Skins

If you upload a custom skin from the app's Account page, the image is sent straight from your device to Mojang's official skin API — it does not pass through or get stored on our servers.

## Changes

This is a small, actively-developed project — this policy may change as features do. Material changes will be noted in the app's release notes.

## Contact

Questions about your data — [open an issue on GitHub](https://github.com/LazyOneShot/mc-launcher/issues).
