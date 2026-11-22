# Changelog

Every version is kept as its own image tag and GitHub Release, so you can go back to an earlier one.
`latest` always points at the newest build. Pin Unraid to a version to freeze it.

| Unraid Repository | Meaning |
| --- | --- |
| `ghcr.io/valigha/archivist:latest` | newest, may change |
| `ghcr.io/valigha/archivist:0.1.5` | that version, frozen |
| `ghcr.io/valigha/archivist:v0.1.5` | same image, `v` prefix |

To roll back: Unraid → Docker → edit the container → set **Repository** to the older version tag → Apply.

## 0.1.5

- Nexus now works like Folio: a cycle reads every page up to the page limit (all pages when the limit is 0) and downloads every new book it finds. Before, it stopped after 10 new books (`MAX_PER_CYCLE`) or after 40 already-in-library galleries in a row (`CATCH_UP_STREAK`)
- Both limits are now off by default. Set `NEXUS_MAX_PER_CYCLE` or `NEXUS_CATCH_UP_STREAK` to a number to bring either back; an explicit 0 now means off (before, 0 was ignored and the old default came back)

## 0.1.4

- Folio: a dropped or timed-out connection while searching is now retried (up to 4 times, waiting longer each time) instead of ending the cycle with a bare "fetch failed". The log now says the real reason, such as ETIMEDOUT or ECONNRESET
- Unraid template: added the Folio settings that the separate Folio container had and this one did not (`FOLIO_API_KEY`, `FOLIO_USER_AGENT`, `FOLIO_INCREMENTAL_PAGES`, `FOLIO_SAFETY_FILTER`, `FOLIO_FILENAME_TITLE_TYPE`, `FOLIO_DOWNLOAD_WORKERS`, `FOLIO_CIRCUMVENT_LOAD_BALANCER`)

## 0.1.3

- Both tabs show the log newest line first, so the latest activity is at the top of the log box and you no longer scroll down after switching tabs. If you scroll down to read something, new lines do not push it out of view

## 0.1.2

- Folio no longer stops a search early. Before, it ended the cycle after 50 already-in-library galleries in a row, even when the page limit was larger (a 10-page limit could stop on page 3). Now it reads every page up to the limit, and all pages when the limit is 0
- To get the old early stop back, set `FOLIO_CATCH_UP_STREAK` to a number such as 50

## 0.1.1

- Nexus: when it has to wait before retrying after an error (the site going quiet and throttling, a dropped or reset connection, or a "too busy" answer), the big clock now says "Trying again in …" and counts down, and the Now card says why it is waiting and how much of the book is already saved
- Waiting between downloads still shows "Next download in …" as before

## 0.1.0

First version. Folio and Nexus run side by side in one container, behind one page.

- Tabs for Folio and Nexus; each is its own dashboard with its own tags, login, settings and log
- One shared library folder. The top of the page shows the total and how many books came from Folio and from Nexus (plus any from other tools), with a Rescan button
- Per-app settings: set `FOLIO_<NAME>` or `NEXUS_<NAME>` to give one app its own value; plain `<NAME>` is shared
- Each app keeps its data in its own folder: `/app/config/folio`, `/app/config/nexus`, `/app/log/folio`, `/app/log/nexus`
- If one app stops it restarts on its own after 5 seconds without touching the other
- Included code: Folio 2.5.2 and Nexus 1.5.4, unchanged except that the log folder is configurable
