# Archivist

Folio (nhentai) and Nexus (HentaiNexus) in one container. One page with a tab for each, one shared library folder.

- **Folio tab**: the Folio dashboard, with its own tags, schedule and settings.
- **Nexus tab**: the Nexus dashboard, with its own login, chips and download delay.
- **Header**: the whole library (every `.cbz`), how many came from Folio, how many from Nexus, and any from other tools. Rescan recounts.

The two apps never share state: if one crashes or is restarted it comes back on its own and the other keeps going.

## Run it

Unraid: use `unraid.xml` (Repository `ghcr.io/valigha/archivist:latest`). Docker Compose: see `docker-compose.yml`. Open `http://<host>:8090/`.

Stop the separate `folio-archivist` and `nexus-archivist` containers first. Settings do not carry over: each app starts fresh in `/app/config/folio` and `/app/config/nexus`. To keep an old setup, copy the old container's `folio.json` or `nexus.json` (and Nexus's `session.json`) into the matching subfolder before starting.

## Settings

Plain names are shared by both apps (`LIBRARY_SPLIT`, `SLEEP_INTERVAL`, `PUID`, `PGID`, `UMASK`, `TZ`). To change one app only, put `FOLIO_` or `NEXUS_` in front: `NEXUS_REQUEST_DELAY_MS=3000` affects Nexus only. App-specific names such as `NHENTAI_TAGS` or `HN_TAGS` also work with the prefix. See `env.example`.

Files in the library: Folio names start with the gallery number, Nexus names start with `HN`, so ids from the two sites never clash.

## Versions and rollback

See `CHANGELOG.md`. Every version has an image tag and a GitHub Release. To go back, set the container's Repository to an older tag, for example `ghcr.io/valigha/archivist:0.1.0`.

## Layout

- `gateway/` — starts both apps, serves the tabbed page, proxies each app under `/folio/` and `/nexus/`
- `apps/folio`, `apps/nexus` — the two apps, vendored from `valigha/folio-archivist` and `valigha/nexus-archivist`
