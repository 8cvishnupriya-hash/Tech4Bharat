(function (root) {
  function channelFlag(sensor) {
    if (!sensor) return "ok";
    if (sensor.max != null && sensor.value > sensor.max) return "bad";
    if (sensor.min != null && sensor.value < sensor.min) return "bad";
    if (sensor.rated != null && sensor.value > sensor.rated) return "bad";
    return "ok";
  }

  function diagnose(machine) {
    const keys = ["temp", "vib", "current"];
    const flags = {};
    keys.forEach(function (key) {
      flags[key] = channelFlag(machine.sensors[key]);
    });
    const bad = keys.filter(function (key) { return flags[key] === "bad"; });
    let level;
    let kind;
    let signature;
    if (bad.length >= 2) {
      level = "red";
      kind = "machine";
      signature = flags.temp === "bad" && flags.vib === "bad" && flags.current === "bad" ? "bearing" : "unknown";
    } else if (bad.length === 1) {
      level = "grey";
      kind = "sensor";
      signature = bad[0];
    } else if (machine.pmOverdue || machine.trend === "worsening") {
      level = "amber";
      kind = "early";
      signature = machine.pmOverdue ? "pm" : "trend";
    } else {
      level = "green";
      kind = "healthy";
      signature = "normal";
    }
    return { level: level, kind: kind, signature: signature, bad: bad, flags: flags };
  }

  function inr(n) {
    const rounded = Math.round(Number(n));
    const sign = rounded < 0 ? "-" : "";
    const s = String(Math.abs(rounded));
    const last3 = s.slice(-3);
    const rest = s.slice(0, -3);
    const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    return "₹" + sign + (rest ? grouped + "," + last3 : last3);
  }

  function payback(kit, avoided, fee) {
    if (!(kit > 0) || !(avoided >= 0) || !(fee >= 0) || [kit, avoided, fee].some(function (n) { return Number.isNaN(n); })) {
      return { ok: false, reason: "missing" };
    }
    const net = avoided - fee;
    if (net <= 0) return { ok: true, months: null, reason: "never" };
    return { ok: true, months: kit / net, reason: "ok" };
  }

  function matchCatalog(catalog, kw, rpm, ie) {
    const hits = catalog.filter(function (row) {
      return row.ie === ie && Math.abs(row.rpm - rpm) <= 200;
    });
    if (!hits.length) return null;
    hits.sort(function (a, b) { return Math.abs(a.kw - kw) - Math.abs(b.kw - kw); });
    const best = hits[0];
    return { row: best, exact: best.kw === kw && best.rpm === rpm };
  }

  function repairTotal(partPrice, visitFee) {
    return (Number(partPrice) || 0) + (Number(visitFee) || 0);
  }

  function savedAmount(downtimeLoss, repair) {
    if (downtimeLoss == null) return null;
    return Math.max(0, Number(downtimeLoss) - Number(repair || 0));
  }

  root.EdgeLogic = {
    channelFlag: channelFlag,
    diagnose: diagnose,
    inr: inr,
    payback: payback,
    matchCatalog: matchCatalog,
    repairTotal: repairTotal,
    savedAmount: savedAmount
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
