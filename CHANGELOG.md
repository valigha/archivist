# Changelog

Every version is kept as its own image tag and GitHub Release, so you can go back to an earlier one.
`latest` always points at the newest build. Pin Unraid to a version to freeze it.

| Unraid Repository | Meaning |
| --- | --- |
| `ghcr.io/valigha/archivist:latest` | newest, may change |
| `ghcr.io/valigha/archivist:0.1.0` | that version, frozen |
| `ghcr.io/valigha/archivist:v0.1.0` | same image, `v` prefix |

To roll back: Unraid → Docker → edit the container → set **Repository** to the older version tag → Apply.

## 0.1.0

First version. Folio and Nexus run side by side in one container, behind one page.

- Tabs for Folio and Nexus; each is its own dashboard with its own tags, login, settings and log
- One shared library folder. The top of the page shows the total and how many books came from Folio and from Nexus (plus any from other tools), with a Rescan button
- Per-app settings: set `FOLIO_<NAME>` or `NEXUS_<NAME>` to give one app its own value; plain `<NAME>` is shared
- Each app keeps its data in its own folder: `/app/config/folio`, `/app/config/nexus`, `/app/log/folio`, `/app/log/nexus`
- If one app stops it restarts on its own after 5 seconds without touching the other
- Included code: Folio 2.5.2 and Nexus 1.5.4, unchanged except that the log folder is configurable
