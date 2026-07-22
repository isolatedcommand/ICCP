/* ICCP module views. Each renders into the #iccp-app mount. */
(function (w) {
  "use strict";
  var C = w.ICCP;

  /* ── Dashboard ── */
  C.views.dashboard = async function (mount) {
    var d = await C.orgApi("/dashboard");
    var rings = d.frameworks.map(function (f) {
      return '<a class="iccp-ring-card" href="/frameworks/">' +
        '<div class="iccp-ring" style="--pct:' + f.percent + '"><span>' + f.percent + "%</span></div>" +
        "<h4>" + C.esc(f.short_name) + "</h4>" +
        (f.target_date ? '<p class="iccp-muted">target ' + C.fmtDate(f.target_date) + "</p>" : "") + "</a>";
    }).join("") || '<p class="iccp-muted">No frameworks adopted yet — start in <a href="/frameworks/">Frameworks</a>.</p>';

    var ev = d.evidence || {};
    var risk = d.risk || {};
    var upcoming = (d.upcoming || []).map(function (u) {
      return "<li>" + C.badge(u.type.replace(/_/g, " "), u.type) + " " + C.esc(u.label) +
        ' <span class="iccp-muted">' + C.fmtDate(u.when) + "</span></li>";
    }).join("") || '<li class="iccp-muted">Nothing due in the next 30 days.</li>';

    mount.innerHTML =
      '<div class="iccp-score-row"><div class="iccp-score"><div class="iccp-ring iccp-ring-lg" style="--pct:' + d.score + '"><span>' + d.score + "%</span></div>" +
      "<h3>Overall compliance</h3></div><div class=\"iccp-rings\">" + rings + "</div></div>" +
      '<div class="iccp-grid3">' +
      '<section class="iccp-card"><h4>Evidence</h4><ul class="iccp-stats">' +
      "<li><strong>" + (ev.approved || 0) + "</strong> approved</li>" +
      "<li><strong>" + (ev.pending_review || 0) + "</strong> pending review</li>" +
      "<li><strong>" + (ev.expired || 0) + "</strong> expired</li></ul>" +
      '<a href="/evidence/">Open evidence →</a></section>' +
      '<section class="iccp-card"><h4>Risk</h4><ul class="iccp-stats">' +
      '<li><strong class="sev-critical">' + (risk.critical || 0) + "</strong> critical</li>" +
      '<li><strong class="sev-high">' + (risk.high || 0) + "</strong> high</li>" +
      '<li><strong class="sev-medium">' + (risk.medium || 0) + "</strong> medium</li></ul>" +
      '<a href="/risks/">Open risk register →</a></section>' +
      '<section class="iccp-card"><h4>Upcoming</h4><ul class="iccp-upcoming">' + upcoming + "</ul></section>" +
      "</div>";
  };

  /* ── Frameworks ── */
  C.views.frameworks = async function (mount) {
    var data = await C.orgApi("/frameworks");
    mount.innerHTML = '<div class="iccp-cards" id="fw-cards"></div><div id="fw-detail"></div>';
    var cards = document.getElementById("fw-cards");
    data.frameworks.forEach(function (f) {
      var card = C.el('<article class="iccp-card iccp-fw-card">' +
        "<h4>" + C.esc(f.short_name) + "</h4><p class=\"iccp-muted\">" + C.esc(f.name) + "</p>" +
        "<p>" + C.esc(f.description) + "</p>" +
        (f.adoption
          ? C.badge("adopted", "approved") + ' <button class="btn btn-solid-border" data-act="reqs">Requirements &amp; assessment</button>'
          : '<button class="btn btn-main" data-act="adopt">Adopt framework</button>') +
        "</article>");
      card.addEventListener("click", async function (e) {
        var act = e.target.getAttribute("data-act");
        if (act === "adopt") {
          try { await C.orgApi("/adoptions", { method: "POST", json: { framework_id: f.id } }); location.reload(); }
          catch (err) { C.toast(err.message, true); }
        }
        if (act === "reqs") showAssessments(f);
      });
      cards.appendChild(card);
    });

    async function showAssessments(f) {
      var det = document.getElementById("fw-detail");
      var a = await C.orgApi("/adoptions/" + f.adoption.id + "/assessments");
      det.innerHTML = "<h3>" + C.esc(f.short_name) + " — requirements</h3>" +
        '<div class="iccp-list">' + a.assessments.map(function (r) {
          return '<div class="iccp-row" data-id="' + r.id + '">' +
            '<span class="iccp-code">' + C.esc(r.code) + "</span>" +
            "<span>" + C.esc(r.title) + '<br><small class="iccp-muted">' + C.esc(r.grouping) + "</small></span>" +
            "<span>" + C.badge(r.status) + " maturity " + r.maturity + "/5</span>" +
            '<button class="btn btn-solid-border" data-assess>Assess</button></div>';
        }).join("") + "</div>";
      det.querySelectorAll("[data-assess]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var row = btn.closest(".iccp-row");
          C.formModal("Assess requirement", [
            { name: "status", label: "Status", type: "select", options: ["unassessed", "not_met", "partially_met", "met", "not_applicable"] },
            { name: "maturity", label: "Maturity (0–5)", type: "number", value: "0" },
            { name: "note", label: "Note", type: "textarea" },
          ], async function (data) {
            if (data.maturity !== undefined) data.maturity = Number(data.maturity);
            await C.orgApi("/assessments/" + row.getAttribute("data-id"), { method: "PATCH", json: data });
            C.toast("Assessment saved");
            showAssessments(f);
          });
        });
      });
    }
  };

  /* ── Controls ── */
  C.views.controls = async function (mount) {
    var data = await C.orgApi("/controls");
    mount.innerHTML = '<p><button class="btn btn-main" id="ctl-new">New control</button></p><div class="iccp-list" id="ctl-list"></div>';
    var list = document.getElementById("ctl-list");
    if (!data.controls.length) list.innerHTML = '<p class="iccp-muted">No controls yet. Create the first one.</p>';
    data.controls.forEach(function (c) {
      var maps = c.mappings.map(function (m) { return '<span class="iccp-chip">' + C.esc(m.code) + "</span>"; }).join(" ");
      var row = C.el('<div class="iccp-row">' +
        '<span class="iccp-code">' + C.esc(c.code) + "</span>" +
        "<span>" + C.esc(c.title) + "<br><small>" + maps + "</small></span>" +
        "<span>" + C.badge(c.status) + '<br><small class="iccp-muted">next review ' + C.fmtDate(c.next_review) + "</small></span>" +
        '<button class="btn btn-solid-border">Edit</button></div>');
      row.querySelector("button").addEventListener("click", function () {
        C.formModal("Edit " + c.code, [
          { name: "title", label: "Title", value: c.title },
          { name: "status", label: "Status", type: "select", value: c.status,
            options: ["not_implemented", "in_progress", "implemented", "attention", "not_applicable"] },
          { name: "review_freq_days", label: "Review frequency (days)", type: "number", value: String(c.review_freq_days) },
          { name: "description", label: "Description", type: "textarea", value: c.description },
        ], async function (data) {
          if (data.review_freq_days) data.review_freq_days = Number(data.review_freq_days);
          await C.orgApi("/controls/" + c.id, { method: "PATCH", json: data });
          C.toast("Control updated"); C.views.controls(mount);
        });
      });
      list.appendChild(row);
    });
    document.getElementById("ctl-new").addEventListener("click", function () {
      C.formModal("New control", [
        { name: "code", label: "Code (e.g. CTL-001)", required: true },
        { name: "title", label: "Title", required: true },
        { name: "description", label: "Description", type: "textarea" },
        { name: "review_freq_days", label: "Review frequency (days)", type: "number", value: "365" },
      ], async function (data) {
        if (data.review_freq_days) data.review_freq_days = Number(data.review_freq_days);
        await C.orgApi("/controls", { method: "POST", json: data });
        C.toast("Control created"); C.views.controls(mount);
      });
    });
  };

  /* ── Evidence ── */
  C.views.evidence = async function (mount) {
    var data = await C.orgApi("/evidence");
    mount.innerHTML = '<p><button class="btn btn-main" id="ev-new">New evidence</button></p><div class="iccp-list" id="ev-list"></div>';
    var list = document.getElementById("ev-list");
    if (!data.evidence.length) list.innerHTML = '<p class="iccp-muted">No evidence yet.</p>';
    data.evidence.forEach(function (e) {
      var ctl = e.controls.map(function (c) { return '<span class="iccp-chip">' + C.esc(c.code) + "</span>"; }).join(" ");
      var row = C.el('<div class="iccp-row">' +
        "<span>" + C.esc(e.name) + "<br><small>" + ctl + "</small></span>" +
        "<span>" + C.badge(e.status) +
        (e.expires_at ? '<br><small class="iccp-muted">expires ' + C.fmtDate(e.expires_at) + "</small>" : "") + "</span>" +
        "<span>" + (e.file_name ? C.esc(e.file_name) + " · v" + e.version : '<span class="iccp-muted">no file</span>') + "</span>" +
        '<span class="iccp-row-actions">' +
        '<label class="btn btn-solid-border iccp-upload">Upload<input type="file" hidden></label>' +
        (e.file_name ? '<a class="btn btn-solid-border" href="' + location.origin + '/api/v1/orgs/' + C.state.orgId + "/evidence/" + e.id + '/file">Download</a>' : "") +
        (e.status === "pending_review" ? '<button class="btn btn-main" data-review>Review</button>' : "") +
        "</span></div>");
      row.querySelector(".iccp-upload input").addEventListener("change", async function () {
        var file = this.files[0];
        if (!file) return;
        try {
          await fetch(location.origin + "/api/v1/orgs/" + C.state.orgId + "/evidence/" + e.id + "/file", {
            method: "PUT", credentials: "include", body: file,
            headers: { "content-type": file.type || "application/octet-stream", "x-file-name": encodeURIComponent(file.name) },
          }).then(function (r) { if (!r.ok) return r.json().then(function (j) { throw new Error(j.error); }); });
          C.toast("Uploaded — now pending review"); C.views.evidence(mount);
        } catch (err) { C.toast(err.message, true); }
      });
      var rev = row.querySelector("[data-review]");
      if (rev) rev.addEventListener("click", function () {
        C.formModal("Review evidence", [
          { name: "decision", label: "Decision", type: "select", options: ["approved", "rejected"] },
          { name: "comment", label: "Comment", type: "textarea" },
        ], async function (data) {
          await C.orgApi("/evidence/" + e.id + "/review", { method: "POST", json: data });
          C.toast("Review recorded"); C.views.evidence(mount);
        });
      });
      list.appendChild(row);
    });
    document.getElementById("ev-new").addEventListener("click", function () {
      C.formModal("New evidence", [
        { name: "name", label: "Name", required: true },
        { name: "description", label: "Description", type: "textarea" },
        { name: "valid_days", label: "Valid for (days)", type: "number", value: "365" },
      ], async function (data) {
        if (data.valid_days) data.valid_days = Number(data.valid_days);
        await C.orgApi("/evidence", { method: "POST", json: data });
        C.toast("Evidence created — upload its file next"); C.views.evidence(mount);
      });
    });
  };

  /* ── Risks ── */
  C.views.risks = async function (mount) {
    var data = await C.orgApi("/risks");
    mount.innerHTML = '<p><button class="btn btn-main" id="rk-new">New risk</button></p><div class="iccp-list" id="rk-list"></div>';
    var list = document.getElementById("rk-list");
    if (!data.risks.length) list.innerHTML = '<p class="iccp-muted">Risk register is empty.</p>';
    data.risks.forEach(function (r) {
      var row = C.el('<div class="iccp-row">' +
        '<span class="iccp-code">' + C.esc(r.code) + "</span>" +
        "<span>" + C.esc(r.title) + '<br><small class="iccp-muted">' + C.esc(r.category) + "</small></span>" +
        '<span><span class="iccp-sev sev-' + r.severity + '">' + r.severity + " · " + r.score + "</span><br>" + C.badge(r.status) + "</span>" +
        '<button class="btn btn-solid-border">Treat</button></div>');
      row.querySelector("button").addEventListener("click", function () {
        C.formModal("Treatment for " + r.code, [
          { name: "strategy", label: "Strategy", type: "select", options: ["mitigate", "accept", "transfer", "avoid"] },
          { name: "plan", label: "Plan", type: "textarea" },
          { name: "due_date", label: "Due date", type: "date" },
        ], async function (data) {
          await C.orgApi("/risks/" + r.id + "/treatments", { method: "POST", json: data });
          C.toast("Treatment recorded"); C.views.risks(mount);
        });
      });
      list.appendChild(row);
    });
    document.getElementById("rk-new").addEventListener("click", function () {
      C.formModal("New risk", [
        { name: "code", label: "Code (e.g. RSK-001)", required: true },
        { name: "title", label: "Title", required: true },
        { name: "category", label: "Category", value: "security" },
        { name: "likelihood", label: "Likelihood (1–5)", type: "number", value: "3" },
        { name: "impact", label: "Impact (1–5)", type: "number", value: "3" },
        { name: "description", label: "Description", type: "textarea" },
      ], async function (data) {
        ["likelihood", "impact"].forEach(function (k) { if (data[k]) data[k] = Number(data[k]); });
        await C.orgApi("/risks", { method: "POST", json: data });
        C.toast("Risk registered"); C.views.risks(mount);
      });
    });
  };

  /* ── Policies ── */
  C.views.policies = async function (mount) {
    var data = await C.orgApi("/policies");
    mount.innerHTML = '<p><button class="btn btn-main" id="pol-new">New policy</button></p><div class="iccp-list" id="pol-list"></div>';
    var list = document.getElementById("pol-list");
    if (!data.policies.length) list.innerHTML = '<p class="iccp-muted">No policies yet.</p>';
    data.policies.forEach(function (p) {
      var row = C.el('<div class="iccp-row">' +
        "<span>" + C.esc(p.title) + '<br><small class="iccp-muted">review ' + C.fmtDate(p.next_review) + "</small></span>" +
        "<span>" + C.badge(p.status) + (p.latest ? '<br><small class="iccp-muted">v' + p.latest.version + " · " + p.latest.acks + " acknowledgements</small>" : "") + "</span>" +
        '<span class="iccp-row-actions"><button class="btn btn-solid-border" data-versions>Versions</button></span></div>');
      row.querySelector("[data-versions]").addEventListener("click", async function () {
        var v = await C.orgApi("/policies/" + p.id + "/versions");
        var latest = v.versions[0];
        C.formModal(p.title + " — v" + (latest ? latest.version : "?"), [
          { name: "body_md", label: "Policy body (markdown)", type: "textarea", value: latest ? latest.body_md : "" },
          { name: "changelog", label: "Change note (creates new version)", required: true },
        ], async function (data) {
          await C.orgApi("/policies/" + p.id + "/versions", { method: "POST", json: data });
          C.toast("New version created"); C.views.policies(mount);
        });
      });
      list.appendChild(row);
    });
    document.getElementById("pol-new").addEventListener("click", function () {
      C.formModal("New policy", [
        { name: "title", label: "Title (e.g. Access Control Policy)", required: true },
        { name: "review_freq_days", label: "Review frequency (days)", type: "number", value: "365" },
        { name: "body_md", label: "Policy body (markdown)", type: "textarea", required: true },
      ], async function (data) {
        if (data.review_freq_days) data.review_freq_days = Number(data.review_freq_days);
        await C.orgApi("/policies", { method: "POST", json: data });
        C.toast("Policy created"); C.views.policies(mount);
      });
    });
  };

  /* ── Audits ── */
  C.views.audits = async function (mount) {
    var data = await C.orgApi("/audits");
    mount.innerHTML = '<p><button class="btn btn-main" id="aud-new">New audit</button></p><div class="iccp-list" id="aud-list"></div><div id="aud-detail"></div>';
    var list = document.getElementById("aud-list");
    if (!data.audits.length) list.innerHTML = '<p class="iccp-muted">No audits yet.</p>';
    data.audits.forEach(function (a) {
      var row = C.el('<div class="iccp-row">' +
        "<span>" + C.esc(a.name) + '<br><small class="iccp-muted">' + C.fmtDate(a.starts_on) + " – " + C.fmtDate(a.ends_on) + "</small></span>" +
        "<span>" + C.badge(a.status) + "<br><small>" + (a.open_findings || 0) + " open / " + (a.findings || 0) + " findings</small></span>" +
        '<button class="btn btn-solid-border">Workspace</button></div>');
      row.querySelector("button").addEventListener("click", async function () {
        var f = await C.orgApi("/audits/" + a.id + "/findings");
        var det = document.getElementById("aud-detail");
        det.innerHTML = "<h3>" + C.esc(a.name) + " — findings</h3>" +
          '<p><button class="btn btn-main" id="fnd-new">Add finding</button></p>' +
          '<div class="iccp-list">' + (f.findings.map(function (x) {
            return '<div class="iccp-row"><span class="iccp-sev sev-' + (x.severity === "critical" ? "critical" : x.severity === "major" ? "high" : "medium") + '">' +
              C.esc(x.severity) + "</span><span>" + C.esc(x.title) +
              (x.corrective_action ? '<br><small class="iccp-muted">' + C.esc(x.corrective_action) + "</small>" : "") +
              "</span><span>" + C.badge(x.status) + "</span></div>";
          }).join("") || '<p class="iccp-muted">No findings.</p>') + "</div>";
        document.getElementById("fnd-new").addEventListener("click", function () {
          C.formModal("New finding", [
            { name: "title", label: "Title", required: true },
            { name: "severity", label: "Severity", type: "select", options: ["observation", "minor", "major", "critical"] },
            { name: "detail", label: "Detail", type: "textarea" },
            { name: "corrective_action", label: "Corrective action", type: "textarea" },
            { name: "due_date", label: "Due date", type: "date" },
          ], async function (data) {
            await C.orgApi("/audits/" + a.id + "/findings", { method: "POST", json: data });
            C.toast("Finding recorded"); row.querySelector("button").click();
          });
        });
      });
      list.appendChild(row);
    });
    document.getElementById("aud-new").addEventListener("click", function () {
      C.formModal("New audit", [
        { name: "name", label: "Name (e.g. ISO 27001 Stage 2 — 2026)", required: true },
        { name: "starts_on", label: "Starts", type: "date" },
        { name: "ends_on", label: "Ends", type: "date" },
      ], async function (data) {
        await C.orgApi("/audits", { method: "POST", json: data });
        C.toast("Audit created"); C.views.audits(mount);
      });
    });
  };
})(window);
