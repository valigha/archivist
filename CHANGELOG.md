# Changelog

Every version is kept as its own image tag and GitHub Release, so you can go back to an earlier one.
`latest` always points at the newest build. Pin Unraid to a version to freeze it.

| Unraid Repository | Meaning |
| --- | --- |
| `ghcr.io/valigha/archivist:latest` | newest, may change |
| `ghcr.io/valigha/archivist:0.4.0` | that version, frozen |
| `ghcr.io/valigha/archivist:v0.4.0` | same image, `v` prefix |

To roll back: Unraid → Docker → edit the container → set **Repository** to the older version tag → Apply.

## 0.4.0

- **Browser add-on for both apps.** New `userscripts/` folder with two Tampermonkey scripts: `folio-nhentai.user.js` (nhentai.net) and `nexus-hentainexus.user.js` (hentainexus.com). Each shows "In library" on books you already have and an **Add** button on the ones you don't
- **New field in the Unraid template: `LIBRARY_IMPORT_KEY`.** It is the key the scripts send (as `X-Api-Key`). One variable covers both apps. Leave it blank and the add-on API stays switched off (requests get 401)
- Nexus gained the "is it in the library" check the Folio side already had: `POST /nexus/api/library/hentainexus/exists` with `{"ids":["123","456"]}`
- Through the combined container the paths carry the app prefix: `/folio/api/import/nhentai`, `/folio/api/library/nhentai/exists`, `/nexus/api/import`, `/nexus/api/library/hentainexus/exists`. Scripts from the separate Folio container need those prefixes and the new address and port
- The Nexus script could not be tried against the live site. If its buttons do not show on a page, tell me which page and I will adjust it

## 0.3.0

- **Nexus file names change.** The `HN` marker moves from the start to the end: `HN21950 Evening Light 2.cbz` becomes `21950 Evening Light 2 [HN].cbz`. The name now starts with the book number and title like Folio's, which suits LANraragi and other viewers
- Folio ignores files ending in `[HN]`, and Nexus only counts files that carry the tag, so a Nexus book and a Folio book with the same number never get mixed up (verified: both #101 downloaded side by side)
- On first start, books saved by older versions (`HN21950 Title.cbz`) are renamed to the new style, in the same folder, and never over an existing file. The log says how many. Set `RENAME_OLD_FILES=0` to skip this
- The setting is now `FILE_TAG` (default `HN`); it replaces `FILE_PREFIX`. Set it as a shared variable, not with a `FOLIO_` or `NEXUS_` prefix, so both apps agree
- Note for LANraragi: renamed files keep their content, so it should keep their entries, but a rescan may be needed

## 0.2.2

- Fix for Nexus downloads failing with `fetch failed: UND_ERR_HEADERS_OVERFLOW`. The site's reply carried more header data than Node's 16 KB default allows, so that book failed every time. Both apps now accept much larger headers (256 KB)

## 0.2.1

- Nexus reads a book's title from the page in more ways (a heading with any class, the page's title tag, or a plain heading) instead of only one exact form. A page where none work is now logged as a warning (`could not find the title on the page`) rather than quietly naming the file by number only, which is what LANraragi then shows
- A book with no title is named `HN123.cbz`, not `HN123 123.cbz`
- Books already saved with number-only names are not renamed

## 0.2.0

- Nexus: new **Pause / Resume** button. Pause lets the book that is downloading finish, then holds (between books and between search pages) until you press Resume. The clock freezes and picks up where it was. Stop still ends the run
- **Search page is remembered, in both Folio and Nexus.** The page the search is on is saved after every page, so a restart or a crash no longer sends you back to page 1. The next run starts two pages before where it stopped (new books push the pages down, so this avoids skipping any). It is cleared when the search finishes or when you change the search chips
- **Start the next search at page …** box in both Folio and Nexus: type a page and press Set, and the next run starts there once. 0 clears it
- Nexus still needs Start pressed after a restart; it then picks up from the saved page
- Folio: Pause already finished the current gallery; pressing Run now afterwards now carries on from the saved page

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
