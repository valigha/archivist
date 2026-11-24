// ==UserScript==
// @name         HentaiNexus → Archivist (Nexus)
// @namespace    local.library.hentainexus
// @version      1.4.2
// @description  Add HentaiNexus books to your Archivist library, and mark ones already in it
// @match        https://hentainexus.com/*
// @match        https://www.hentainexus.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  // Archivist serves Nexus under /nexus/ on its one port. The key is the container's
  // LIBRARY_IMPORT_KEY variable. If you saved settings before, they override these:
  // use the Tampermonkey menu -> "Library settings" to change them.
  const DEFAULTS = {
    baseUrl: "http://10.1.0.216:8090",
    apiPath: "/nexus/api/import",
    existsPath: "/nexus/api/library/hentainexus/exists",
    apiKey: "",
  };

  const checked = new Set();
  let checkTimer = null;
  let lastUrl = location.href;

  function cfg(key) {
    return GM_getValue(key, DEFAULTS[key]);
  }

  function idFromHref(href) {
    const m = String(href || "").match(/\/view\/(\d+)/);
    return m ? m[1] : null;
  }

  function pageGalleryId() {
    return idFromHref(location.pathname);
  }

  function galleryTitle() {
    const h1 = document.querySelector("h1.title, h1");
    const og = document.querySelector('meta[property="og:title"]');
    return (h1 && h1.textContent.trim()) || (og && og.content.replace(/\s*-\s*HentaiNexus.*$/i, "")) || "";
  }

  function cardTitle(anchor) {
    const img = anchor.querySelector("img");
    return (img && (img.getAttribute("alt") || img.getAttribute("title"))) || anchor.textContent.trim().slice(0, 200);
  }

  function setStatus(btn, text, kind) {
    btn.textContent = text;
    btn.dataset.kind = kind || "";
  }

  function openSettings() {
    const baseUrl = prompt("Library base URL (no trailing slash)", cfg("baseUrl"));
    if (baseUrl == null) return;
    const apiPath = prompt("Import path", cfg("apiPath"));
    if (apiPath == null) return;
    const existsPath = prompt("Exists-check path", cfg("existsPath"));
    if (existsPath == null) return;
    const apiKey = prompt("Key (the container's LIBRARY_IMPORT_KEY, sent as X-Api-Key)", cfg("apiKey"));
    if (apiKey == null) return;
    GM_setValue("baseUrl", baseUrl.trim().replace(/\/+$/, ""));
    GM_setValue("apiPath", apiPath.trim().startsWith("/") ? apiPath.trim() : "/" + apiPath.trim());
    GM_setValue("existsPath", existsPath.trim().startsWith("/") ? existsPath.trim() : "/" + existsPath.trim());
    GM_setValue("apiKey", apiKey.trim());
    alert("Saved. Reload the page.");
  }

  GM_registerMenuCommand("Library settings", openSettings);

  function ensureStyle() {
    if (document.getElementById("lib-add-style")) return;
    const style = document.createElement("style");
    style.id = "lib-add-style";
    style.textContent = `
      #lib-add-btn {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 99999;
        border: 0;
        border-radius: 8px;
        padding: 10px 14px;
        font: 600 14px/1.2 system-ui, sans-serif;
        color: #fff;
        background: #ed2553;
        box-shadow: 0 6px 18px rgba(0,0,0,.35);
        cursor: pointer;
      }
      .lib-card-add {
        position: absolute;
        top: 6px;
        right: 6px;
        z-index: 5;
        border: 0;
        border-radius: 6px;
        padding: 4px 8px;
        font: 700 11px/1.2 system-ui, sans-serif;
        color: #fff;
        background: #ed2553;
        box-shadow: 0 2px 8px rgba(0,0,0,.45);
        cursor: pointer;
      }
      /* Only anchor the button; never change the page's own layout (no display/size changes). */
      a[data-lib-add] { position: relative; }
      #lib-add-btn[data-kind="ok"],
      .lib-card-add[data-kind="ok"] { background: #2e7d32; }
      #lib-add-btn[data-kind="exists"],
      .lib-card-add[data-kind="exists"] { background: #6d4c41; }
      #lib-add-btn[data-kind="err"],
      .lib-card-add[data-kind="err"] { background: #b71c1c; }
      #lib-add-btn:disabled,
      .lib-card-add:disabled { opacity: .75; cursor: wait; }
    `;
    document.documentElement.appendChild(style);
  }

  function markOwned(ids) {
    const owned = new Set(ids.map(String));
    document.querySelectorAll("[data-gallery-id]").forEach((btn) => {
      if (owned.has(btn.dataset.galleryId)) setStatus(btn, "In library", "exists");
    });
  }

  function scheduleCheck() {
    clearTimeout(checkTimer);
    checkTimer = setTimeout(checkLoaded, 400);
  }

  function checkLoaded() {
    const baseUrl = cfg("baseUrl");
    const existsPath = cfg("existsPath");
    if (!baseUrl || !existsPath) return;

    const ids = [];
    document.querySelectorAll("[data-gallery-id]").forEach((btn) => {
      const id = btn.dataset.galleryId;
      if (id && !checked.has(id)) ids.push(id);
    });
    const unique = [...new Set(ids)].slice(0, 50);
    if (!unique.length) return;
    unique.forEach((id) => checked.add(id));

    GM_xmlhttpRequest({
      method: "POST",
      url: baseUrl + existsPath,
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": cfg("apiKey") || "",
      },
      data: JSON.stringify({ ids: unique }),
      timeout: 15000,
      onload: (res) => {
        if (res.status < 200 || res.status >= 300) {
          unique.forEach((id) => checked.delete(id));
          return;
        }
        let body = {};
        try { body = JSON.parse(res.responseText || "{}"); } catch (_) {}
        markOwned(Array.isArray(body.exists) ? body.exists : []);
      },
      onerror: () => unique.forEach((id) => checked.delete(id)),
      ontimeout: () => unique.forEach((id) => checked.delete(id)),
    });
  }

  function add(btn, id, title) {
    const baseUrl = cfg("baseUrl");
    const apiPath = cfg("apiPath");
    if (!baseUrl) {
      openSettings();
      return;
    }
    const idle = btn.classList.contains("lib-card-add") ? "Add" : "Add to library";
    setStatus(btn, "Adding…", "");
    btn.disabled = true;

    GM_xmlhttpRequest({
      method: "POST",
      url: baseUrl + apiPath,
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": cfg("apiKey") || "",
      },
      data: JSON.stringify({
        source: "hentainexus",
        id,
        url: `https://hentainexus.com/view/${id}`,
        title: title || "",
      }),
      timeout: 30000,
      onload: (res) => {
        btn.disabled = false;
        if (btn.dataset.galleryId !== String(id)) return;
        let body = {};
        try { body = JSON.parse(res.responseText || "{}"); } catch (_) {}
        if (res.status >= 200 && res.status < 300) {
          const status = body.status || "queued";
          if (status === "exists") setStatus(btn, "In library", "exists");
          else setStatus(btn, "Added", "ok");
          checked.add(String(id));
          return;
        }
        setStatus(btn, res.status === 401 ? "Bad key" : res.status === 409 ? "Log in (Nexus tab)" : `Failed ${res.status}`, "err");
        console.warn("library add failed", res.status, res.responseText);
        setTimeout(() => {
          if (btn.dataset.galleryId === String(id)) setStatus(btn, idle, "");
        }, 2500);
      },
      onerror: () => {
        btn.disabled = false;
        setStatus(btn, "No reach", "err");
        setTimeout(() => setStatus(btn, idle, ""), 2500);
      },
      ontimeout: () => {
        btn.disabled = false;
        setStatus(btn, "Timeout", "err");
        setTimeout(() => setStatus(btn, idle, ""), 2500);
      },
    });
  }

  function injectGalleryButton() {
    const id = pageGalleryId();
    let btn = document.getElementById("lib-add-btn");
    if (!id) {
      if (btn) btn.remove();
      return;
    }
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "lib-add-btn";
      btn.type = "button";
      btn.textContent = "Add to library";
      btn.addEventListener("click", () => {
        const current = btn.dataset.galleryId;
        add(btn, current, galleryTitle());
      });
      document.body.appendChild(btn);
    }
    if (btn.dataset.galleryId !== id) {
      checked.delete(id);
      btn.dataset.galleryId = id;
      setStatus(btn, "Add to library", "");
    }
  }

  // The link around a card can be wider than the card you see, so pin the button to the
  // picture's own top-right corner instead of the link's. Only the button moves; the page does not.
  function place(anchor, btn) {
    const img = anchor.querySelector("img");
    if (!img) return;
    const a = anchor.getBoundingClientRect();
    const i = img.getBoundingClientRect();
    if (!i.width) return;
    btn.style.top = Math.max(0, Math.round(i.top - a.top)) + 6 + "px";
    btn.style.right = Math.max(0, Math.round(a.right - i.right)) + 6 + "px";
  }

  function bindCard(anchor) {
    const id = idFromHref(anchor.getAttribute("href"));
    if (!id) return;
    let btn = anchor.querySelector(".lib-card-add");
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "lib-card-add";
      btn.textContent = "Add";
      btn.title = "Add to library";
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const current = btn.dataset.galleryId;
        add(btn, current, cardTitle(anchor));
      });
      anchor.appendChild(btn);
      const img = anchor.querySelector("img");
      if (img) {
        img.addEventListener("load", () => place(anchor, btn));
        if (window.ResizeObserver) new ResizeObserver(() => place(anchor, btn)).observe(anchor);
      }
    }
    place(anchor, btn);
    if (btn.dataset.galleryId !== id) {
      checked.delete(id);
      btn.dataset.galleryId = id;
      btn.disabled = false;
      setStatus(btn, "Add", "");
    }
    anchor.dataset.libAdd = id;
  }

  function reconcile(root) {
    injectGalleryButton();
    const scope = root && root.querySelectorAll ? root : document;
    // Cards are the /view/<id> links that hold a picture; plain title links are left alone.
    scope.querySelectorAll('a[href*="/view/"]').forEach((a) => { if (a.querySelector("img")) bindCard(a); });
    scheduleCheck();
  }

  function onNavigation() {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    checked.clear();
    document.querySelectorAll("[data-gallery-id]").forEach((btn) => {
      delete btn.dataset.galleryId;
    });
    setTimeout(() => reconcile(document), 50);
    setTimeout(() => reconcile(document), 600);
  }

  function boot() {
    ensureStyle();
    reconcile(document);
    const observer = new MutationObserver(() => reconcile(document));
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("popstate", onNavigation);
    window.addEventListener("pageshow", onNavigation);
    const push = history.pushState;
    const replace = history.replaceState;
    history.pushState = function () {
      push.apply(this, arguments);
      onNavigation();
    };
    history.replaceState = function () {
      replace.apply(this, arguments);
      onNavigation();
    };
    document.addEventListener("click", (event) => {
      const link = event.target.closest && event.target.closest("a");
      if (!link) return;
      if (link.closest(".pagination, .pagination-page") || /[?&]page=/.test(link.getAttribute("href") || "")) {
        setTimeout(onNavigation, 50);
        setTimeout(() => reconcile(document), 700);
      }
    });
  }

  boot();
})();
