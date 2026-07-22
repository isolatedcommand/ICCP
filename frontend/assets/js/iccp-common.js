/* ICCP shared front-end runtime: API client, org context, UI primitives.
 * Views register themselves on window.ICCP.views (see iccp-views.js). */
(function (w) {
  "use strict";

  var state = { me: null, orgId: localStorage.getItem("iccp.org") || null };

  async function api(path, opts) {
    opts = opts || {};
    if (opts.json !== undefined) {
      opts.body = JSON.stringify(opts.json);
      opts.headers = Object.assign({ "content-type": "application/json" }, opts.headers);
      delete opts.json;
    }
    // Local demo preview: /page/?demo=1 routes API calls to the demo org too.
    var demoQ = /(?:^|[?&])demo=1(?:&|$)/.test(location.search) ? (path.indexOf("?") < 0 ? "?demo=1" : "&demo=1") : "";
    var res = await fetch(location.origin + "/api/v1" + path + demoQ, Object.assign({ credentials: "include" }, opts));
    var data = null;
    try { data = await res.json(); } catch (e) { /* file downloads etc. */ }
    if (!res.ok) throw new Error((data && data.error) || ("HTTP " + res.status));
    return data;
  }

  function orgApi(path, opts) { return api("/orgs/" + state.orgId + path, opts); }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function el(html) {
    var t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    return isNaN(d) ? "—" : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function badge(text, kind) {
    return '<span class="iccp-badge is-' + esc(kind || text) + '">' + esc(String(text).replace(/_/g, " ")) + "</span>";
  }

  function toast(msg, isError) {
    var t = el('<div class="iccp-toast' + (isError ? " is-error" : "") + '">' + esc(msg) + "</div>");
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add("show"); }, 10);
    setTimeout(function () { t.classList.remove("show"); setTimeout(function () { t.remove(); }, 300); }, 3200);
  }

  /* Modal with a form; fields: [{name,label,type(text|textarea|select|number|date),options,required,value}] */
  function formModal(title, fields, onSubmit) {
    var inner = fields.map(function (f) {
      var input;
      if (f.type === "textarea") input = '<textarea name="' + f.name + '" rows="5">' + esc(f.value || "") + "</textarea>";
      else if (f.type === "select") input = '<select name="' + f.name + '">' +
        (f.options || []).map(function (o) {
          var v = typeof o === "string" ? o : o.value, l = typeof o === "string" ? o : o.label;
          return '<option value="' + esc(v) + '"' + (f.value === v ? " selected" : "") + ">" + esc(l) + "</option>";
        }).join("") + "</select>";
      else input = '<input name="' + f.name + '" type="' + (f.type || "text") + '" value="' + esc(f.value || "") + '"' +
        (f.required ? " required" : "") + ">";
      return '<label class="iccp-field"><span>' + esc(f.label) + "</span>" + input + "</label>";
    }).join("");
    var m = el(
      '<div class="iccp-modal-wrap"><div class="iccp-modal" role="dialog" aria-modal="true">' +
      "<h3>" + esc(title) + "</h3><form>" + inner +
      '<div class="iccp-modal-actions"><button type="submit" class="btn btn-main">Save</button>' +
      '<button type="button" class="btn btn-solid-border" data-close>Cancel</button></div>' +
      "</form></div></div>");
    function close() { m.remove(); }
    m.addEventListener("click", function (e) { if (e.target === m || e.target.hasAttribute("data-close")) close(); });
    m.querySelector("form").addEventListener("submit", async function (e) {
      e.preventDefault();
      var data = {};
      new FormData(e.target).forEach(function (v, k) { if (v !== "") data[k] = v; });
      try { await onSubmit(data); close(); } catch (err) { toast(err.message, true); }
    });
    document.body.appendChild(m);
  }

  async function boot() {
    var mount = document.getElementById("iccp-app");
    if (!mount) return;
    if (/^compliance-demo\./.test(location.hostname)) {
      var banner = el('<div class="iccp-demo-banner">Demo environment — shared sandbox, resets nightly. ' +
        '<button type="button" class="iccp-demo-reset">Reset demo data</button> ' +
        '<a href="https://compliance.isolatedcommand.com/">Use the real platform →</a></div>');
      banner.querySelector(".iccp-demo-reset").addEventListener("click", async function () {
        var btn = this;
        if (!confirm("Reset the demo? This wipes everyone's changes and restores the sample data.")) return;
        btn.disabled = true; btn.textContent = "Resetting…";
        try {
          await api("/demo/reset", { method: "POST" });
          toast("Demo reset — reloading");
          setTimeout(function () { location.reload(); }, 700);
        } catch (err) {
          toast(err.message, true); btn.disabled = false; btn.textContent = "Reset demo data";
        }
      });
      document.body.insertBefore(banner, document.body.firstChild);
    }
    try {
      state.me = await api("/me");
    } catch (err) {
      mount.innerHTML = '<div class="iccp-empty"><h3>Sign-in required</h3><p>' + esc(err.message) +
        "</p><p>This application is protected by Cloudflare Access.</p></div>";
      return;
    }
    var sel = document.getElementById("iccp-org");
    var userEl = document.getElementById("iccp-user");
    if (userEl) userEl.textContent = state.me.user.email;
    var orgsList = state.me.organisations;

    if (!orgsList.length) {
      mount.innerHTML = "";
      mount.appendChild(el('<div class="iccp-empty"><h3>Create your organisation</h3>' +
        "<p>You are signed in but not a member of any organisation yet.</p>" +
        '<button class="btn btn-main" id="iccp-neworg">Create organisation</button></div>'));
      document.getElementById("iccp-neworg").addEventListener("click", function () {
        formModal("New organisation", [
          { name: "name", label: "Name", required: true },
          { name: "slug", label: "Slug (lowercase, hyphens)", required: true },
        ], async function (data) {
          var org = await api("/orgs", { method: "POST", json: data });
          localStorage.setItem("iccp.org", org.id);
          location.reload();
        });
      });
      return;
    }

    if (!state.orgId || !orgsList.some(function (o) { return o.id === state.orgId; })) {
      state.orgId = orgsList[0].id;
    }
    if (sel) {
      sel.innerHTML = orgsList.map(function (o) {
        return '<option value="' + esc(o.id) + '"' + (o.id === state.orgId ? " selected" : "") + ">" + esc(o.name) + "</option>";
      }).join("");
      sel.addEventListener("change", function () {
        localStorage.setItem("iccp.org", sel.value);
        location.reload();
      });
    }
    state.role = (orgsList.find(function (o) { return o.id === state.orgId; }) || {}).role;

    var view = mount.getAttribute("data-view");
    var render = w.ICCP.views[view];
    if (!render) { mount.innerHTML = '<div class="iccp-empty">Unknown view: ' + esc(view) + "</div>"; return; }
    try { await render(mount); }
    catch (err) { mount.innerHTML = '<div class="iccp-empty"><h3>Could not load</h3><p>' + esc(err.message) + "</p></div>"; }
  }

  w.ICCP = { api: api, orgApi: orgApi, state: state, esc: esc, el: el, fmtDate: fmtDate, badge: badge, toast: toast, formModal: formModal, views: {} };
  document.addEventListener("DOMContentLoaded", boot);
})(window);
