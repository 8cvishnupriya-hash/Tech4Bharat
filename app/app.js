(function () {
  if (typeof document === "undefined") return;

  var LANGS = { en: "en-IN", hi: "hi-IN", ta: "ta-IN", te: "te-IN" };
  var VIEWS = ["diagnostics", "ivr", "spares", "mechanics", "cost", "ledger"];
  var KEY = "edgecare-v1";
  var pendingFocus = null;

  var state = {
    lang: "en",
    machineId: "m01",
    view: "home",
    snap: { m01: "earlier" },
    shop: { m01: "murugan" },
    mech: { m01: "karthik" },
    profile: {},
    logs: {},
    sms: {},
    hammer: {},
    twins: [],
    layout: "front",
    caption: "",
    pay: { kit: "", avoided: "", fee: "" },
    payResult: null,
    draft: { name: "", kw: "15", rpm: "1440", ie: "IE3" },
    formError: null,
    notice: ""
  };

  function load() {
    try {
      var saved = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!saved) return;
      ["lang", "snap", "shop", "mech", "profile", "logs", "sms", "hammer", "twins", "pay"].forEach(function (key) {
        if (saved[key] != null) state[key] = saved[key];
      });
    } catch (err) { /* keep defaults */ }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        lang: state.lang,
        snap: state.snap,
        shop: state.shop,
        mech: state.mech,
        profile: state.profile,
        logs: state.logs,
        sms: state.sms,
        hammer: state.hammer,
        twins: state.twins,
        pay: state.pay
      }));
    } catch (err) { /* private mode */ }
  }

  function t(key) {
    var pack = EDGE_I18N[state.lang] || EDGE_I18N.en;
    if (pack[key] != null) return pack[key];
    return EDGE_I18N.en[key] != null ? EDGE_I18N.en[key] : key;
  }

  function tf(key, vars) {
    var text = t(key);
    if (!vars) return text;
    Object.keys(vars).forEach(function (name) {
      text = text.split("{" + name + "}").join(String(vars[name]));
    });
    return text;
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function tfe(key, vars) {
    var safe = {};
    if (vars) Object.keys(vars).forEach(function (name) { safe[name] = esc(vars[name]); });
    return tf(key, safe);
  }

  function machines() {
    return EDGE_DATA.machines.concat(state.twins || []);
  }

  function findMachine(id) {
    var list = machines();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function logsOf(id) {
    if (!state.logs[id]) {
      var machine = findMachine(id);
      state.logs[id] = ((machine && machine.logs) || []).map(function (row) { return Object.assign({}, row); });
    }
    return state.logs[id];
  }

  function num(value) {
    var n = Number(value);
    if (Math.abs(n - Math.round(n)) < 0.05) return String(Math.round(n));
    return String(Math.round(n * 10) / 10);
  }

  function when(age) {
    if (age == null) return t("latestSample");
    if (age === 0) return t("justNow");
    return tf("minAgo", { n: age });
  }

  function placeOf(machine) {
    if (machine.twin) return t("onDevice");
    return machine.bay + " · " + machine.line;
  }

  function present(id) {
    var base = findMachine(id);
    if (!base) return null;
    var snap = null;
    if (base.snapshots && base.snapshots.length) {
      var snapId = state.snap[base.id] || base.snapshots[0].id;
      snap = base.snapshots.filter(function (item) { return item.id === snapId; })[0] || base.snapshots[0];
    }
    var sensors = snap ? snap.sensors : base.sensors;
    var age = snap ? snap.age : base.age;
    var view = {
      id: base.id,
      code: base.code,
      name: base.name,
      node: base.node || t("onDevice"),
      place: placeOf(base),
      twin: !!base.twin,
      learning: !!base.learning,
      faultCode: base.faultCode || "",
      partName: base.partName || "",
      sku: base.sku || "",
      pmOverdue: !!base.pmOverdue,
      pmName: base.pmName || "",
      overdueDays: base.overdueDays || 1,
      downtimeLoss: base.downtimeLoss,
      sensors: sensors,
      age: age,
      profiles: base.profiles || [],
      sampleProfile: base.sampleProfile || "loaded",
      hammer: base.hammer || null,
      shops: base.shops || []
    };
    var diagnosis = EdgeLogic.diagnose(view);
    var shopId = state.shop[base.id];
    if (!view.shops.some(function (shop) { return shop.id === shopId; })) shopId = view.shops[0] ? view.shops[0].id : null;
    var shop = view.shops.filter(function (item) { return item.id === shopId; })[0] || null;
    var mech = null;
    if (state.mech[base.id]) {
      mech = EDGE_DATA.mechanics.filter(function (item) { return item.id === state.mech[base.id]; })[0] || null;
    }
    var partPrice = diagnosis.level === "green" || !shop ? 0 : shop.price;
    var visit = diagnosis.level === "green" || !mech ? 0 : mech.fee;
    var repair = EdgeLogic.repairTotal(partPrice, visit);
    var loss = diagnosis.level === "red" && view.downtimeLoss != null ? view.downtimeLoss : null;
    var saved = loss == null ? null : EdgeLogic.savedAmount(loss, repair);
    var profileId = state.profile[base.id] || view.sampleProfile;
    var profile = view.profiles.filter(function (item) { return item.id === profileId; })[0] || view.profiles[0] || null;
    return {
      base: base, view: view, d: diagnosis, shop: shop, mech: mech,
      repair: repair, loss: loss, saved: saved, profile: profile, snap: snap
    };
  }

  function channelLabel(key) {
    if (key === "temp") return t("channelTemp");
    if (key === "vib") return t("channelVib");
    return t("channelCurrent");
  }

  function headline(page) {
    var name = page.view.name;
    if (page.d.level === "red" && page.d.signature === "bearing") return tf("h1red", { name: name });
    if (page.d.level === "red") return tf("h1unknown", { name: name });
    return tf("h1" + page.d.level, { name: name });
  }

  function lede(page) {
    var view = page.view;
    if (page.d.level === "red" && page.d.signature === "bearing") {
      return tf("ledeRed", {
        part: view.partName, sku: view.sku, place: view.place,
        price: EdgeLogic.inr(page.shop ? page.shop.price : 0)
      });
    }
    if (page.d.level === "red") return t("ledeUnknown");
    if (page.d.level === "green" && view.learning) return t("ledeLearn");
    if (page.d.level === "green") return tf("ledeGreen", { node: view.node, place: view.place });
    if (page.d.level === "amber") return tf("ledeAmber", { name: view.name, pm: view.pmName, days: view.overdueDays });
    var bad = page.d.bad[0];
    return tf("ledeGrey", { channel: channelLabel(bad), hw: view.sensors[bad].hw });
  }

  function statusLabel(page) {
    if (page.d.level === "red") return tf("faultCode", { code: page.view.faultCode || "F-104" });
    if (page.d.level === "green") return t("allOk");
    if (page.d.level === "amber") return t("early");
    return t("sensorBad");
  }

  function svg(inner) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">' + inner + "</svg>";
  }

  var ICONS = {
    activity: svg('<path d="M3 12h4l2-6 4 12 2-6h6"/>'),
    phone: svg('<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>'),
    box: svg('<path d="M3 8l9-4 9 4-9 4-9-4z"/><path d="M3 8v8l9 4 9-4V8"/><path d="M12 12v8"/>'),
    wrench: svg('<path d="M14.7 6.3a4 4 0 0 0-5.6 5.6L3 18l3 3 6.1-6.1a4 4 0 0 0 5.6-5.6l-2.2 2.2-2.2-2.2z"/>'),
    rupee: svg('<path d="M7 5h10"/><path d="M7 9h10"/><path d="M7 5c4 0 6 2 6 4s-2 4-6 4"/><path d="M8 13l8 7"/>'),
    grid: svg('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
    speaker: svg('<path d="M4 10h3l5-4v12l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6"/>'),
    arrow: svg('<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>')
  };

  function pill(level) {
    if (level === "red") return '<span class="pill pill-red">' + esc(t("pillFault")) + "</span>";
    if (level === "amber") return '<span class="pill pill-amber">' + esc(t("pillEarly")) + "</span>";
    if (level === "grey") return '<span class="pill pill-grey">' + esc(t("pillSensor")) + "</span>";
    return '<span class="pill pill-green">' + esc(t("pillOk")) + "</span>";
  }

  function sensorLine(sensor) {
    return num(sensor.value) + " " + sensor.unit;
  }

  function cardDiag(page) {
    var temp = sensorLine(page.view.sensors.temp);
    var vib = sensorLine(page.view.sensors.vib);
    if (page.d.signature === "bearing") return tf("cardDiagRed", { temp: temp, vib: vib });
    if (page.d.level === "red") return tf("cardDiagUnknown", { temp: temp, vib: vib });
    if (page.d.level === "grey") return tf("cardDiagGrey", { channel: channelLabel(page.d.bad[0]) });
    if (page.d.level === "amber") return tf("cardDiagAmber", { pm: page.view.pmName });
    return tf("cardDiagGreen", { temp: temp, vib: vib });
  }

  function moneyVars(page) {
    return {
      code: page.view.faultCode || "",
      name: page.view.name,
      part: page.view.partName,
      sku: page.view.sku,
      repair: String(page.repair).replace(/[^\d]/g, ""),
      loss: page.loss == null ? "0" : String(page.loss),
      shop: page.shop ? page.shop.name : "",
      km: page.shop ? page.shop.km : "",
      channel: page.d.bad[0] ? channelLabel(page.d.bad[0]) : "",
      pm: page.view.pmName
    };
  }

  function speechText(page) {
    var vars = moneyVars(page);
    vars.repair = page.repair;
    vars.loss = page.loss == null ? 0 : page.loss;
    if (page.d.signature === "bearing") return tf("speechRed", vars);
    if (page.d.level === "red") return tf("speechUnknown", vars);
    if (page.d.level === "amber") return tf("speechAmber", vars);
    if (page.d.level === "grey") return tf("speechGrey", vars);
    return tf("speechGreen", vars);
  }

  function announce(text) {
    state.caption = text;
    var live = document.getElementById("live");
    if (!live) return;
    live.textContent = "";
    setTimeout(function () { live.textContent = text; }, 30);
  }

  function speak(text) {
    announce(text);
    render();
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    var utter = new SpeechSynthesisUtterance(text);
    utter.lang = LANGS[state.lang] || "en-IN";
    window.speechSynthesis.speak(utter);
  }

  function readHash() {
    var raw = (location.hash || "").replace(/^#\/?/, "");
    var bits = raw.split("/").filter(Boolean);
    if (bits[0] === "nameplate") {
      state.view = "nameplate";
      return;
    }
    var id = bits[0] || "m01";
    state.machineId = findMachine(id) ? id : "m01";
    state.view = VIEWS.indexOf(bits[1]) >= 0 ? bits[1] : "home";
  }

  function navigate(hash, focus) {
    state.caption = "";
    state.notice = "";
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    pendingFocus = focus || "#page-title";
    if (location.hash === hash) {
      readHash();
      render({ focus: pendingFocus });
      pendingFocus = null;
      return;
    }
    location.hash = hash;
  }

  function machineHash(id, view) {
    return "#/" + id + (view && view !== "home" ? "/" + view : "");
  }

  function header() {
    var options = ["en", "ta", "hi", "te"].map(function (code) {
      var label = { en: "English", ta: "தமிழ்", hi: "हिन्दी", te: "తెలుగు" }[code];
      return '<option value="' + code + '"' + (state.lang === code ? " selected" : "") + ">" + label + "</option>";
    }).join("");
    return '<header class="mast"><div class="mast-inner"><div class="brand"><span class="mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span><p class="word"><span>Tech</span><span class="bharat">4Bharat</span></p><p class="badge">' + esc(t("offline")) + '</p></div><div class="lang"><label class="visually-hidden" for="lang">' + esc(t("lang")) + '</label><select id="lang">' + options + '</select></div></div></header>';
  }

  function legend() {
    var rows = [
      ["green", "gTitle", "gHint"],
      ["amber", "aTitle", "aHint"],
      ["red", "rTitle", "rHint"],
      ["grey", "yTitle", "yHint"]
    ];
    return '<aside class="legend" aria-label="' + esc(t("legend")) + '"><h2>' + esc(t("legend")) + "</h2>" +
      rows.map(function (row) {
        return '<article class="status-' + row[0] + '"><span class="dot" aria-hidden="true"></span><strong>' + esc(t(row[1])) + "</strong><span>" + esc(t(row[2])) + "</span></article>";
      }).join("") + "</aside>";
  }

  function tabs(page) {
    return '<div class="tabs" role="tablist" aria-label="' + esc(t("modules")) + '">' + machines().map(function (machine) {
      var pressed = machine.id === page.view.id;
      return '<button class="tab" type="button" role="tab" aria-pressed="' + pressed + '" data-go="' + machineHash(machine.id) + '">' + esc(machine.code + " · " + machine.name) + "</button>";
    }).join("") + "</div>";
  }

  function stateName(level) {
    if (level === "green") return t("stateHealthy");
    if (level === "amber") return t("stateEarly");
    if (level === "grey") return t("stateSensor");
    return t("stateFault");
  }

  function stateSelect(page) {
    var list = page.base.snapshots;
    if (!list || list.length < 2) {
      return '<div class="state-field"><label for="state">' + esc(t("stateWord")) + '</label><select id="state" disabled><option>' + esc(stateName(page.d.level)) + "</option></select></div>";
    }
    return '<div class="state-field"><label for="state">' + esc(t("stateWord")) + '</label><select id="state">' + list.map(function (snap) {
      var selected = page.snap && page.snap.id === snap.id;
      var label = snap.id === "earlier" ? t("stateHealthy") : t("stateFault");
      return '<option value="' + esc(snap.id) + '"' + (selected ? " selected" : "") + ">" + esc(label) + "</option>";
    }).join("") + "</select></div>";
  }

  function standby(page) {
    var shop = page.shop || (page.view.shops[0] || null);
    var mech = page.mech || EDGE_DATA.mechanics[0];
    var repair = page.repair;
    var loss = page.loss;
    if (loss == null && page.view.downtimeLoss && shop) {
      loss = page.view.downtimeLoss;
      repair = shop.price + (mech ? mech.fee : 0);
    }
    return {
      shop: shop,
      mech: mech,
      repair: repair,
      loss: loss,
      saved: loss == null ? null : loss - repair
    };
  }

  function home(page) {
    var id = page.view.id;
    var level = page.d.level;
    var show = standby(page);
    var cards = [
      { view: "diagnostics", icon: "activity", title: "diag", body: cardDiag(page), pill: level === "green" ? '<span class="pill pill-green">' + esc(t("pillOk")) + "</span>" : pill(level) },
      { view: "ivr", icon: "phone", title: "ivr", body: t("cardIvr"), pill: '<span class="pill pill-grey">' + esc(t("pillVoice")) + "</span>" },
      { view: "spares", icon: "box", title: "spares", body: show.shop ? tf(level === "green" ? "cardSpareStandby" : "cardSpare", { shop: show.shop.name, km: show.shop.km, part: page.view.sku || page.view.partName, price: EdgeLogic.inr(show.shop.price) }) : t("cardSpareOff"), pill: '<span class="pill pill-green">' + esc(tf("pillStock", { n: page.view.shops.length })) + "</span>" },
      { view: "mechanics", icon: "wrench", title: "mechs", body: show.mech ? tf("cardMech", { name: show.mech.name, km: show.mech.km, min: show.mech.etaMin, fee: EdgeLogic.inr(show.mech.fee) }) : t("cardMechOff"), pill: show.mech ? '<span class="pill pill-green">' + esc(tf("pillEta", { n: show.mech.etaMin })) + "</span>" : '<span class="pill pill-grey">' + esc(t("pillIdle")) + "</span>" },
      { view: "cost", icon: "rupee", title: "cost", body: show.saved != null ? tf("cardCost", { repair: EdgeLogic.inr(show.repair), loss: EdgeLogic.inr(show.loss) }) : t("cardCostOff"), pill: show.saved != null ? '<span class="pill pill-green">' + esc(tf("pillSave", { amount: EdgeLogic.inr(show.saved) })) + "</span>" : '<span class="pill pill-grey">' + esc(level === "grey" ? t("pillCheck") : t("pillOk")) + "</span>" },
      { view: "ledger", icon: "grid", title: "ledger", body: t("cardLedger"), pill: '<span class="pill pill-grey">' + esc(tf("pillViews", { v: 4, l: logsOf(id).length })) + "</span>" }
    ];
    return '<section class="hero"><div class="toolbar">' + tabs(page) + stateSelect(page) + "</div>" +
      '<p class="status status-' + level + '"><span class="dot" aria-hidden="true"></span>' + esc(statusLabel(page)) + "</p>" +
      "<h1 id=\"page-title\" tabindex=\"-1\">" + esc(headline(page)) + "</h1>" +
      '<p class="lede">' + esc(lede(page)) + "</p>" +
      (level === "green" || page.view.twin ? "" : '<p class="meta">' + esc(tf("sampleLine", { node: page.view.node, place: page.view.place, when: when(page.view.age) })) + "</p>") +
      '<div class="actions"><button class="btn btn-navy" type="button" data-go="' + machineHash(id, "diagnostics") + '">' + esc(t("openDiag")) + '</button><button class="btn btn-orange" type="button" data-act="listen">' + ICONS.speaker + esc(t("listen")) + "</button></div>" +
      (state.caption ? '<p class="caption" id="caption">' + esc(state.caption) + "</p>" : "") +
      "</section>" +
      '<div class="section-head"><h2>' + esc(t("modules")) + "</h2><span>" + esc(tf("moduleCount", { n: 6 })) + "</span></div>" +
      '<div class="modules">' + cards.map(function (card) {
        return '<button class="card" type="button" data-go="' + machineHash(id, card.view) + '"><span class="card-top"><span class="ico">' + ICONS[card.icon] + "</span>" + card.pill + '</span><span class="card-title">' + esc(t(card.title)) + "</span><p>" + esc(card.body) + '</p><span class="card-foot"><span>' + esc(t("viewDetails")) + '</span><span class="go" aria-hidden="true">' + ICONS.arrow + "</span></span></button>";
      }).join("") + "</div>" +
      (page.base.note ? '<p class="caption">' + esc(page.base.note) + "</p>" : "") +
      '<div class="home-links"><button class="text-btn" type="button" data-go="#/nameplate">' + esc(t("add")) + "</button>" +
      (page.view.twin ? '<button class="text-btn" type="button" data-act="remove">' + esc(t("remove")) + "</button>" : "") + "</div>";
  }

  function back(id) {
    return '<button class="text-btn" type="button" data-go="' + machineHash(id) + '">' + esc(t("backHome")) + "</button>";
  }

  function limitText(sensor) {
    if (sensor.min != null && sensor.max != null) return sensor.min + "–" + sensor.max + " " + sensor.unit;
    if (sensor.max != null) return "< " + sensor.max + " " + sensor.unit;
    if (sensor.rated != null) return sensor.rated + " " + sensor.unit;
    return "";
  }

  function deltaText(page, key) {
    if (!page.profile) return "";
    var baseline = page.profile.baseline[key];
    var value = page.view.sensors[key].value;
    var diff = Math.round((value - baseline) * 10) / 10;
    if (Math.abs(diff) < 0.15) return t("atBaseline");
    var unit = page.view.sensors[key].unit;
    return tf("deltaUp", { n: (diff > 0 ? "+" : "") + diff + " " + unit });
  }

  function tagFor(page, key) {
    var bad = page.d.flags[key] === "bad";
    if (page.d.level === "grey" && bad) return t("tagSuspect");
    if (page.d.level === "red" && bad) return t("tagConfirmed");
    if (page.d.level === "amber") return t("tagInside");
    return t("tagNormal");
  }

  function diagnostics(page) {
    var id = page.view.id;
    var keys = ["temp", "vib", "current"];
    var verdictKey = page.d.signature === "bearing" ? "verdictMachine" : page.d.signature === "unknown" ? "verdictUnknown" : page.d.level === "grey" ? "verdictSensor" : page.d.level === "amber" ? "verdictEarly" : "verdictGreen";
    var explainKey = page.d.signature === "bearing" ? "explainMachine" : page.d.signature === "unknown" ? "explainUnknown" : page.d.level === "grey" ? "explainSensor" : page.d.level === "amber" ? "explainEarly" : "explainGreen";
    var explain = tf(explainKey, { channel: page.d.bad[0] ? channelLabel(page.d.bad[0]) : "", hw: page.d.bad[0] ? page.view.sensors[page.d.bad[0]].hw : "", pm: page.view.pmName });
    var sampleProfile = page.view.profiles.filter(function (item) { return item.id === page.view.sampleProfile; })[0];
    var warn = page.profile && sampleProfile && !page.profile.match
      ? '<p class="banner banner-warn">' + esc(tf("profileWarn", { sample: t(sampleProfile.label), other: t(page.profile.label) })) + "</p>"
      : "";
    return back(id) + '<h1 id="page-title" tabindex="-1">' + esc(t("diagTitle")) + "</h1>" +
      '<p class="meta">' + esc(page.view.name + " · " + page.view.place + " · " + page.view.node) + "</p>" +
      (page.d.level === "red" ? '<p class="banner banner-red">' + esc(t("stop")) + "</p>" : page.d.level === "green" ? "" : '<p class="banner banner-ok">' + esc(t("noStop")) + "</p>") +
      '<div class="stats">' + keys.map(function (key) {
        var sensor = page.view.sensors[key];
        var klass = page.d.flags[key] === "bad" ? "bad" : "ok";
        var limit = sensor.rated != null ? tf("rated", { text: limitText(sensor) }) : tf("safe", { text: limitText(sensor) });
        return '<article class="stat"><em>' + esc(sensor.name + " (" + sensor.hw + ")") + '</em><strong class="' + klass + '">' + esc(sensorLine(sensor)) + "</strong><p>" + esc(limit) + "</p><p>" + esc(deltaText(page, key)) + "</p></article>";
      }).join("") + "</div>" +
      '<article class="panel"><h2>' + esc(t(verdictKey)) + "</h2><p>" + esc(explain) + "</p>" +
      '<h3>' + esc(t("ownNormal")) + "</h3><p class=\"note\">" + esc(t("ownHint")) + "</p>" +
      '<label for="profile">' + esc(t("profile")) + '</label><select id="profile">' + page.view.profiles.map(function (item) {
        return '<option value="' + esc(item.id) + '"' + (page.profile && page.profile.id === item.id ? " selected" : "") + ">" + esc(t(item.label)) + "</option>";
      }).join("") + "</select>" + warn +
      "<h3>" + esc(t("cross")) + '</h3><ul class="check">' + keys.map(function (key) {
        var sensor = page.view.sensors[key];
        return "<li><strong>" + esc(sensor.hw + " · " + sensor.name) + "</strong><span>" + esc(sensorLine(sensor) + " · " + deltaText(page, key)) + '</span><span class="pill pill-navy">' + esc(tagFor(page, key)) + "</span></li>";
      }).join("") + "</ul></article>" +
      '<div class="actions"><button class="btn btn-navy" type="button" data-go="' + machineHash(id, "spares") + '">' + esc(t("findPart")) + '</button><button class="btn btn-orange" type="button" data-go="' + machineHash(id, "mechanics") + '">' + esc(t("findMech")) + "</button>" +
      (page.view.hammer ? '<button class="btn btn-navy" type="button" data-act="hammer">' + esc(t("hammer")) + "</button>" : "") + "</div>" +
      (state.hammer[id] && page.view.hammer ? '<p class="caption">' + esc(page.view.hammer.loose ? tf("hammerLoose", { base: page.view.hammer.baselineHz, sample: page.view.hammer.sampleHz }) : tf("hammerOk", { base: page.view.hammer.baselineHz, sample: page.view.hammer.sampleHz })) + "</p>" : "");
  }

  function ivr(page) {
    var id = page.view.id;
    var messages = state.sms[id] || [];
    var keys = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    return back(id) + '<h1 id="page-title" tabindex="-1">' + esc(t("ivrTitle")) + "</h1>" +
      '<div class="phone"><div class="screen"><p class="status status-' + page.d.level + '">' + esc(statusLabel(page)) + "</p><strong>" + esc(page.view.name) + "</strong><p>" + esc(lede(page)) + "</p><p>" + esc(t("press1")) + "</p><p>" + esc(t("press2")) + "</p></div>" +
      '<div class="keys">' + keys.map(function (key) {
        var label = key === 1 ? t("key1") : key === 2 ? t("key2") : key === 3 ? t("key3") : String(key);
        return '<button class="key key-' + key + '" type="button" data-act="ivr" data-key="' + key + '">' + esc(label) + "</button>";
      }).join("") + "</div><p class=\"zero\">" + esc(t("zero")) + "</p></div>" +
      (state.caption ? '<p class="caption" id="caption">' + esc(state.caption) + "</p>" : '<p class="note">' + esc(t("only")) + "</p>") +
      "<h2>" + esc(t("smsTitle")) + "</h2>" +
      (messages.length ? '<ul class="logs">' + messages.map(function (row) { return '<li class="log">' + esc(row.text) + "</li>"; }).join("") + "</ul>" : '<p class="note">' + esc(page.d.level === "green" ? t("noAlert") : t("smsTitle")) + "</p>");
  }

  function spares(page) {
    return back(page.view.id) + '<h1 id="page-title" tabindex="-1">' + esc(t("sparesTitle")) + "</h1>" +
      '<div class="choices">' + page.view.shops.map(function (shop) {
        var pressed = page.shop && page.shop.id === shop.id;
        return '<button class="choice" type="button" aria-pressed="' + pressed + '" data-act="shop" data-id="' + esc(shop.id) + '"><span class="choice-top"><strong>' + esc(shop.name) + '</strong><span class="pill pill-green">' + esc(t("inStock")) + '</span></span><p>' + esc(tf("away", { km: shop.km })) + " · " + esc(page.view.sku || page.view.partName) + " · " + esc(EdgeLogic.inr(shop.price)) + "</p><p>" + esc(shop.source === "pitch" ? t("pitchPrice") : t("demoPrice")) + (pressed ? " · " + esc(t("using")) : "") + "</p></button>";
      }).join("") + "</div>";
  }

  function mechanics(page) {
    return back(page.view.id) + '<h1 id="page-title" tabindex="-1">' + esc(t("mechsTitle")) + "</h1>" +
      (page.d.level === "red" ? '<p class="banner banner-red">' + esc(t("stop")) + "</p>" : "") +
      (state.notice ? '<p class="caption">' + esc(state.notice) + "</p>" : "") +
      '<div class="choices">' + EDGE_DATA.mechanics.map(function (mech) {
        var pressed = page.mech && page.mech.id === mech.id;
        return '<article class="choice"><span class="choice-top"><strong>' + esc(mech.name) + "</strong>" + (pressed ? '<span class="pill pill-green">' + esc(t("assigned")) + "</span>" : "") + "</span><p>" + esc(tf("away", { km: mech.km })) + " · " + esc(tf("eta", { n: mech.etaMin })) + "</p><p>" + esc(tf("fee", { amount: EdgeLogic.inr(mech.fee) })) + '</p><button class="btn btn-navy" type="button" data-act="assign" data-id="' + esc(mech.id) + '">' + esc(pressed ? t("assigned") : t("assign")) + "</button></article>";
      }).join("") + "</div>";
  }

  function cost(page) {
    var max = Math.max(page.loss || 0, page.repair || 0, 1);
    var lossWidth = page.loss ? Math.max(8, Math.round(page.loss / max * 100)) : 0;
    var fixWidth = page.repair ? Math.max(8, Math.round(page.repair / max * 100)) : 0;
    var note = page.view.id === "m01" && page.d.level === "red" ? t("pitchNote") : page.d.level === "grey" ? t("sensorNote") : t("otherNote");
      var chart = page.loss == null ? '<p>' + esc(t("noLoss")) + "</p>" : '<div class="bars" aria-hidden="true"><div><div class="bar-label"><span>' + esc(t("loss")) + "</span><span>" + esc(EdgeLogic.inr(page.loss)) + '</span></div><div class="track"><span class="loss" style="width:' + lossWidth + '%"></span></div></div><div><div class="bar-label"><span>' + esc(t("repair")) + "</span><span>" + esc(EdgeLogic.inr(page.repair)) + '</span></div><div class="track"><span class="fix" style="width:' + fixWidth + '%"></span></div></div></div><p><strong>' + esc(t("saved")) + "</strong> " + esc(EdgeLogic.inr(page.saved)) + '</p><table class="plain visually-hidden"><caption>' + esc(t("saved")) + "</caption><tbody><tr><th>" + esc(t("loss")) + "</th><td>" + esc(EdgeLogic.inr(page.loss)) + "</td></tr><tr><th>" + esc(t("repair")) + "</th><td>" + esc(EdgeLogic.inr(page.repair)) + "</td></tr><tr><th>" + esc(t("saved")) + "</th><td>" + esc(EdgeLogic.inr(page.saved)) + "</td></tr></tbody></table>";
    var result = "";
    if (state.payResult) {
      if (state.payResult.reason === "missing" || state.payResult.reason === "bad") result = '<p class="field-error" role="alert">' + esc(t(state.payResult.reason === "bad" ? "badNumber" : "missing")) + "</p>";
      else if (state.payResult.reason === "never") result = '<p class="caption" role="status">' + esc(t("never")) + "</p>";
      else result = '<p class="caption" role="status">' + esc(tf("months", { n: state.payResult.months })) + "</p>";
    }
    return back(page.view.id) + '<h1 id="page-title" tabindex="-1">' + esc(t("costTitle")) + "</h1><p>" + esc(note) + "</p>" + chart +
      '<form class="form" id="pay-form"><h2>' + esc(t("payback")) + "</h2><p>" + esc(t("formula")) + "</p>" +
      "<label>" + esc(t("kit")) + '<input id="kit" name="kit" inputmode="decimal" value="' + esc(state.pay.kit) + '"></label>' +
      "<label>" + esc(t("avoided")) + '<input id="avoided" name="avoided" inputmode="decimal" value="' + esc(state.pay.avoided) + '"></label>' +
      "<label>" + esc(t("feeMonth")) + '<input id="fee" name="fee" inputmode="decimal" value="' + esc(state.pay.fee) + '"></label>' +
      '<button class="btn btn-navy" type="submit">' + esc(t("calc")) + "</button>" + result + "</form>";
  }

  function schematic(which) {
    var dots = {
      front: [[70, 90, "S1"], [150, 80, "S2"], [230, 100, "S3"]],
      back: [[80, 70, "I"], [160, 110, "A"], [240, 80, "S3"]],
      top: [[90, 70, "S1"], [170, 60, "ESP"], [250, 80, "S3"]],
      floor: [[60, 100, "S1"], [140, 90, "S2"], [250, 110, "S3"]]
    }[which];
    var caption = { front: t("viewFront"), back: t("viewBack"), top: t("viewTop"), floor: t("viewFloor") }[which];
    return '<svg class="schematic" viewBox="0 0 320 160" role="img" aria-label="' + esc(caption) + '"><rect x="20" y="40" width="120" height="70" rx="10" fill="#dbe7f5" stroke="#16325c"/><rect x="140" y="55" width="40" height="24" fill="#c2410c"/><circle cx="230" cy="75" r="36" fill="#e8eef8" stroke="#16325c"/><text x="48" y="80">Drive</text><text x="210" y="80">Load</text>' +
      dots.map(function (dot) {
        return '<circle cx="' + dot[0] + '" cy="' + dot[1] + '" r="8" fill="#c2410c"/><text x="' + (dot[0] + 10) + '" y="' + (dot[1] - 8) + '">' + dot[2] + "</text>";
      }).join("") + "</svg><p class=\"note\">" + esc(caption) + "</p>";
  }

  function ledger(page) {
    var id = page.view.id;
    var views = ["front", "back", "top", "floor"];
    var canDictate = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    var error = state.formError && state.formError.symptom ? '<p class="field-error" id="symptom-error">' + esc(state.formError.symptom) + "</p>" : "";
    return back(id) + '<h1 id="page-title" tabindex="-1">' + esc(t("ledgerTitle")) + "</h1>" +
      '<div class="views" role="tablist">' + views.map(function (view) {
        return '<button type="button" class="snap" aria-pressed="' + (state.layout === view) + '" data-act="layout" data-id="' + view + '">' + esc(t(view)) + "</button>";
      }).join("") + "</div>" + schematic(state.layout) +
      "<h2>" + esc(t("logs")) + '</h2><ul class="logs">' + logsOf(id).map(function (row) {
        return '<li class="log"><header><strong>' + esc(row.title) + '</strong><span class="pill pill-navy">' + esc(t(row.tag)) + "</span></header><p>" + esc(row.detail) + " · " + esc(when(row.age)) + "</p></li>";
      }).join("") + "</ul>" +
      '<form class="form" id="log-form"><label for="symptom">' + esc(t("symptom")) + '</label><textarea id="symptom" name="symptom"' + (error ? ' aria-invalid="true" aria-describedby="symptom-error"' : "") + "></textarea>" + error +
      '<div class="actions"><button class="btn btn-navy" type="submit">' + esc(t("saveLog")) + "</button>" +
      (canDictate ? '<button class="btn btn-orange" type="button" data-act="dictate">' + esc(t("dictate")) + "</button>" : "") +
      (page.view.hammer ? '<button class="btn btn-navy" type="button" data-act="hammer">' + esc(t("hammer")) + "</button>" : "") +
      "</div></form>" +
      (state.hammer[id] && page.view.hammer ? '<p class="caption">' + esc(page.view.hammer.loose ? tf("hammerLoose", { base: page.view.hammer.baselineHz, sample: page.view.hammer.sampleHz }) : tf("hammerOk", { base: page.view.hammer.baselineHz, sample: page.view.hammer.sampleHz })) + "</p>" : "");
  }

  function nameplate() {
    var draft = state.draft;
    var err = state.formError || {};
    function field(id, key, type) {
      var message = err[key] ? '<p class="field-error" id="' + id + '-error">' + esc(err[key]) + "</p>" : "";
      var described = err[key] ? ' aria-invalid="true" aria-describedby="' + id + '-error"' : "";
      if (key === "ie") {
        return "<label for=\"" + id + "\">" + esc(t(key)) + '<select id="' + id + '" name="' + key + '"' + described + ">" +
          ["IE2", "IE3", "IE4"].map(function (value) {
            return '<option' + (draft.ie === value ? " selected" : "") + ">" + value + "</option>";
          }).join("") + "</select></label>" + message;
      }
      return "<label for=\"" + id + "\">" + esc(t(key === "kw" ? "kw" : key === "rpm" ? "rpm" : "name")) + '<input id="' + id + '" name="' + key + '" ' + (type || "text") + ' value="' + esc(draft[key] || "") + '"' + described + "></label>" + message;
    }
    return '<button class="text-btn" type="button" data-go="' + machineHash(state.machineId) + '">' + esc(t("backHome")) + "</button>" +
      '<h1 id="page-title" tabindex="-1">' + esc(t("nameplate")) + "</h1><p class=\"note\">" + esc(t("catalogNote")) + "</p>" +
      (err.summary ? '<p class="summary" role="alert">' + esc(err.summary) + "</p>" : "") +
      (state.notice ? '<p class="caption" role="status">' + esc(state.notice) + "</p>" : "") +
      '<form class="form" id="twin-form">' + field("machine-name", "name") + field("machine-kw", "kw", 'inputmode="decimal"') + field("machine-rpm", "rpm", 'inputmode="decimal"') + field("machine-ie", "ie") +
      '<button class="btn btn-orange" type="submit">' + esc(t("create")) + "</button></form>" +
      "<details><summary>" + esc(t("kitTitle")) + "</summary><table class=\"kit-table\"><thead><tr><th>" + esc(t("modules")) + "</th><th>" + esc(t("mvp")) + "</th><th>" + esc(t("industrial")) + "</th></tr></thead><tbody>" +
      EDGE_DATA.kit.map(function (row) {
        return "<tr><th>" + esc(t(row.signal)) + "</th><td>" + esc(row.mvp) + "</td><td>" + esc(row.industrial) + "</td></tr>";
      }).join("") + "</tbody></table></details>" +
      "<details><summary>" + esc(t("innovations")) + "</summary><ol class=\"innovations\">" +
      [1, 2, 3, 4, 5, 6, 7, 8].map(function (n) { return "<li>" + esc(t("inn" + n)) + "</li>"; }).join("") + "</ol></details>";
  }

  function footer() {
    return '<footer class="site-footer"><div class="tricolor" aria-hidden="true"><i></i><i></i><i></i></div><div class="mast-inner footer-inner"><p class="footer-title">' + esc(t("tagline")) + "</p><p>" + esc(t("footer")) + "</p></div></footer>";
  }

  function shell() {
    var page = state.view === "nameplate" ? null : present(state.machineId);
    var body;
    if (state.view === "nameplate") body = nameplate();
    else if (!page) body = "<p>" + esc(t("back")) + "</p>";
    else if (state.view === "home") body = home(page);
    else if (state.view === "diagnostics") body = diagnostics(page);
    else if (state.view === "ivr") body = ivr(page);
    else if (state.view === "spares") body = spares(page);
    else if (state.view === "mechanics") body = mechanics(page);
    else if (state.view === "cost") body = cost(page);
    else body = ledger(page);
    var frame = state.view === "home" ? "home-stage" : "page-card";
    return header() + '<div class="shell"><main class="stage ' + frame + '" id="main">' + body + "</main></div>";
  }

  function render(opts) {
    document.documentElement.lang = LANGS[state.lang] || "en-IN";
    var skip = document.querySelector(".skip");
    if (skip) skip.textContent = t("skip");
    document.getElementById("app").innerHTML = shell();
    var focus = opts && opts.focus;
    if (focus) {
      var el = document.querySelector(focus);
      if (el) el.focus();
    }
  }

  function doIvr(key) {
    var page = present(state.machineId);
    if (!page) return;
    if (page.d.level === "green") {
      speak(tf("speechGreen", { name: page.view.name }));
      return;
    }
    if (key === "3") {
      speak(speechText(page));
      return;
    }
    if (key !== "1" && key !== "2") {
      announce(t("keyOther"));
      render();
      return;
    }
    var mode = key === "1" ? "delivery" : "pickup";
    var vars = moneyVars(page);
    vars.repair = page.repair;
    var sms = tf(mode === "delivery" ? "smsDeliver" : "smsPickup", vars);
    if (!state.sms[page.view.id]) state.sms[page.view.id] = [];
    state.sms[page.view.id].unshift({ mode: mode, text: sms });
    logsOf(page.view.id).unshift({ tag: "info", title: mode === "delivery" ? t("key1") : t("key2"), detail: page.shop ? page.shop.name : "", age: 0 });
    save();
    speak(tf(mode === "delivery" ? "confirmDeliver" : "confirmPickup", { shop: page.shop ? page.shop.name : "" }));
  }

  function createTwin(form) {
    var data = new FormData(form);
    var draft = {
      name: String(data.get("name") || "").trim(),
      kw: String(data.get("kw") || "").trim(),
      rpm: String(data.get("rpm") || "").trim(),
      ie: String(data.get("ie") || "IE3")
    };
    state.draft = draft;
    var errors = {};
    if (!draft.name) errors.name = t("needName");
    var kw = Number(draft.kw);
    var rpm = Number(draft.rpm);
    if (!(kw > 0)) errors.kw = t("needKw");
    if (!(rpm > 0)) errors.rpm = t("needRpm");
    if (Object.keys(errors).length) {
      errors.summary = t("errSummary");
      state.formError = errors;
      state.notice = "";
      render({ focus: "#machine-name" });
      return;
    }
    state.formError = null;
    var match = EdgeLogic.matchCatalog(EDGE_DATA.catalog, kw, rpm, draft.ie);
    var count = machines().length + 1;
    var id = "twin-" + Date.now();
    var baseline = { temp: 55, vib: 1.2, current: Math.max(1, Math.round(kw * 0.55 * 10) / 10) };
    var twin = {
      id: id,
      code: "M-" + String(count).padStart(2, "0"),
      name: draft.name,
      twin: true,
      learning: true,
      node: "",
      sampleProfile: "loaded",
      profiles: [{ id: "loaded", label: "profileLoaded", match: true, baseline: baseline }],
      sensors: {
        temp: { value: baseline.temp, unit: "°C", min: 40, max: 75, hw: "PT100", name: "Bearing temp" },
        vib: { value: baseline.vib, unit: "mm/s", max: 4.5, hw: "MPU6050", name: "Vibration" },
        current: { value: baseline.current, unit: "A", rated: Math.max(baseline.current + 1, Math.round(kw * 0.8 * 10) / 10), hw: "ACS712", name: "Motor load" }
      },
      shops: [],
      logs: [],
      age: 0
    };
    state.twins.push(twin);
    state.logs[id] = [];
    twin.note = match
      ? tf("twinReady", { name: draft.name, frame: match.row.frame, de: match.row.de, nde: match.row.nde })
      : tf("noRow", { kw: kw, rpm: rpm, ie: draft.ie });
    save();
    navigate(machineHash(id), "#page-title");
    announce(twin.note);
  }

  document.addEventListener("click", function (event) {
    var go = event.target.closest("[data-go]");
    if (go) {
      event.preventDefault();
      navigate(go.getAttribute("data-go"), "#page-title");
      return;
    }
    var act = event.target.closest("[data-act]");
    if (!act) return;
    var action = act.getAttribute("data-act");
    var id = act.getAttribute("data-id");
    if (action === "listen") {
      var page = present(state.machineId);
      if (page) speak(speechText(page));
    } else if (action === "ivr") {
      doIvr(act.getAttribute("data-key"));
    } else if (action === "snap") {
      state.snap[state.machineId] = id;
      save();
      render({ focus: ".snap[aria-pressed='true']" });
    } else if (action === "shop") {
      state.shop[state.machineId] = id;
      save();
      render({ focus: ".choice[aria-pressed='true']" });
    } else if (action === "assign") {
      state.mech[state.machineId] = id;
      var mech = EDGE_DATA.mechanics.filter(function (item) { return item.id === id; })[0];
      logsOf(state.machineId).unshift({ tag: "info", title: mech.name, detail: t("assigned"), age: 0 });
      state.notice = tf("booked", { name: mech.name, amount: EdgeLogic.inr(mech.fee) });
      save();
      announce(state.notice);
      render();
    } else if (action === "layout") {
      state.layout = id;
      render({ focus: ".views button[aria-pressed='true']" });
    } else if (action === "hammer") {
      state.hammer[state.machineId] = true;
      save();
      var machine = present(state.machineId);
      var text = machine.view.hammer.loose
        ? tf("hammerLoose", { base: machine.view.hammer.baselineHz, sample: machine.view.hammer.sampleHz })
        : tf("hammerOk", { base: machine.view.hammer.baselineHz, sample: machine.view.hammer.sampleHz });
      announce(text);
      render();
    } else if (action === "remove") {
      state.twins = state.twins.filter(function (item) { return item.id !== state.machineId; });
      save();
      navigate("#/m01", "#page-title");
    } else if (action === "dictate") {
      var Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Rec) return;
      var rec = new Rec();
      rec.lang = LANGS[state.lang] || "en-IN";
      rec.onresult = function (result) {
        var box = document.getElementById("symptom");
        if (box) box.value = result.results[0][0].transcript;
      };
      rec.start();
    }
  });

  document.addEventListener("change", function (event) {
    if (event.target.id === "lang") {
      state.lang = event.target.value;
      save();
      render({ focus: "#lang" });
    } else if (event.target.id === "profile") {
      state.profile[state.machineId] = event.target.value;
      save();
      render({ focus: "#profile" });
    } else if (event.target.id === "state") {
      state.snap[state.machineId] = event.target.value;
      save();
      render({ focus: "#state" });
    }
  });

  document.addEventListener("input", function (event) {
    if (event.target.id === "kit" || event.target.id === "avoided" || event.target.id === "fee") {
      state.pay[event.target.id] = event.target.value;
    }
  });

  document.addEventListener("submit", function (event) {
    if (event.target.id === "pay-form") {
      event.preventDefault();
      var kit = Number(state.pay.kit);
      var avoided = Number(state.pay.avoided);
      var fee = Number(state.pay.fee);
      if (state.pay.kit === "" || state.pay.avoided === "" || state.pay.fee === "") state.payResult = { reason: "missing" };
      else if (!(kit > 0) || !(avoided >= 0) || !(fee >= 0)) state.payResult = { reason: "bad" };
      else {
        var result = EdgeLogic.payback(kit, avoided, fee);
        state.payResult = result.reason === "ok"
          ? { reason: "ok", months: String(Math.round(result.months * 10) / 10) }
          : { reason: result.reason };
      }
      save();
      render({ focus: "#pay-form button" });
    } else if (event.target.id === "log-form") {
      event.preventDefault();
      var text = document.getElementById("symptom").value.trim();
      if (!text) {
        state.formError = { symptom: t("needSymptom") };
        render({ focus: "#symptom" });
        return;
      }
      state.formError = null;
      logsOf(state.machineId).unshift({ tag: "info", title: text, detail: t("onDevice"), age: 0 });
      save();
      announce(t("onDevice"));
      render({ focus: "#page-title" });
    } else if (event.target.id === "twin-form") {
      event.preventDefault();
      createTwin(event.target);
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && state.view !== "home") {
      navigate(machineHash(state.machineId), "#page-title");
      return;
    }
    if (state.view === "ivr" && "123".indexOf(event.key) >= 0 && !event.target.matches("input, textarea, select")) {
      doIvr(event.key);
    }
  });

  window.addEventListener("hashchange", function () {
    state.caption = "";
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    readHash();
    render({ focus: pendingFocus || "#page-title" });
    pendingFocus = null;
  });

  load();
  if (!location.hash) location.replace("#/m01");
  readHash();
  render({ focus: "#page-title" });
})();
