(function (root) {
  root.EDGE_DATA = {
    catalog: [
      { kw: 0.75, rpm: 1440, ie: "IE2", frame: "80", de: "6202-2RS", nde: "6201-2RS" },
      { kw: 1.5, rpm: 1440, ie: "IE3", frame: "90L", de: "6204-2RS", nde: "6203-2RS" },
      { kw: 3.7, rpm: 1440, ie: "IE3", frame: "112M", de: "6205-2RS", nde: "6204-2RS" },
      { kw: 5.5, rpm: 1440, ie: "IE3", frame: "132S", de: "6206-2RS", nde: "6205-2RS" },
      { kw: 7.5, rpm: 1440, ie: "IE3", frame: "132M", de: "6207-2RS", nde: "6206-2RS" },
      { kw: 11, rpm: 1460, ie: "IE3", frame: "160M", de: "6208-2RS", nde: "6206-2RS" },
      { kw: 15, rpm: 1440, ie: "IE3", frame: "160L", de: "6208-2RS", nde: "6205-2RS" }
    ],
    mechanics: [
      { id: "karthik", name: "Karthik Raja", km: 1.4, etaMin: 5, fee: 350 },
      { id: "yusuf", name: "Yusuf Khan", km: 2.8, etaMin: 15, fee: 400 },
      { id: "meena", name: "Meena Engineering", km: 4.5, etaMin: 25, fee: 500 }
    ],
    kit: [
      { signal: "kitVib", mvp: "MPU-6050", industrial: "IIS3DWB / ADXL1002" },
      { signal: "kitCur", mvp: "ACS712", industrial: "Split-core CT" },
      { signal: "kitTemp", mvp: "PT100", industrial: "Thermocouple" },
      { signal: "kitEdge", mvp: "ESP32", industrial: "ESP32-S3 · IP65, supercap / LiFePO4" }
    ],
    machines: [
      {
        id: "m01",
        code: "M-01",
        name: "CNC Lathe #02",
        bay: "Bay B",
        line: "Line 2",
        node: "ESP32-NODE-01",
        faultCode: "F-104",
        partName: "Main spindle bearing",
        sku: "SKF 6205-2RS",
        downtimeLoss: 31700,
        priceSource: "pitch",
        sampleProfile: "loaded",
        profiles: [
          { id: "loaded", label: "profileLoaded", match: true, baseline: { temp: 62.2, vib: 2.1, current: 10.4 } },
          { id: "light", label: "profileLight", match: false, baseline: { temp: 48, vib: 1.1, current: 6.2 } }
        ],
        hammer: { baselineHz: 180, sampleHz: 146, loose: true },
        snapshots: [
          {
            id: "latest",
            age: 6,
            sensors: {
              temp: { value: 94.2, unit: "°C", min: 40, max: 75, hw: "PT100", name: "Bearing temp" },
              vib: { value: 9.4, unit: "mm/s", max: 4.5, hw: "MPU6050", name: "Vibration" },
              current: { value: 18.6, unit: "A", rated: 12, hw: "ACS712", name: "Motor load" }
            }
          },
          {
            id: "earlier",
            age: 18,
            sensors: {
              temp: { value: 62.2, unit: "°C", min: 40, max: 75, hw: "PT100", name: "Bearing temp" },
              vib: { value: 2.1, unit: "mm/s", max: 4.5, hw: "MPU6050", name: "Vibration" },
              current: { value: 9.8, unit: "A", rated: 12, hw: "ACS712", name: "Motor load" }
            }
          }
        ],
        shops: [
          { id: "murugan", name: "Sri Murugan Spares", km: 1.2, price: 540, source: "pitch" },
          { id: "lakshmi", name: "Lakshmi Bearings", km: 2.4, price: 575, source: "demo" },
          { id: "annai", name: "Annai Motors", km: 3.1, price: 610, source: "demo" }
        ],
        logs: [
          { tag: "active", title: "Spindle bearing F-104", detail: "High priority", age: 6 },
          { tag: "resolved", title: "Coolant leak", detail: "Fixed", age: 12 },
          { tag: "info", title: "Spindle vibration", detail: "Normal on the earlier snapshot", age: 18 }
        ]
      },
      {
        id: "m02",
        code: "M-02",
        name: "Hydraulic Press #04",
        bay: "Bay B",
        line: "Line 2",
        node: "ESP32-NODE-02",
        pmOverdue: true,
        pmName: "Lubrication PM",
        overdueDays: 1,
        partName: "Lubrication kit",
        sku: "PM-KIT",
        priceSource: "demo",
        sampleProfile: "loaded",
        profiles: [
          { id: "loaded", label: "profileLoaded", match: true, baseline: { temp: 64, vib: 2.4, current: 12.1 } }
        ],
        hammer: { baselineHz: 160, sampleHz: 158, loose: false },
        age: null,
        sensors: {
          temp: { value: 71, unit: "°C", min: 40, max: 75, hw: "PT100", name: "Bearing temp" },
          vib: { value: 3.9, unit: "mm/s", max: 4.5, hw: "MPU6050", name: "Vibration" },
          current: { value: 14.2, unit: "A", rated: 16, hw: "ACS712", name: "Motor load" }
        },
        shops: [
          { id: "murugan", name: "Sri Murugan Spares", km: 1.2, price: 900, source: "demo" },
          { id: "lakshmi", name: "Lakshmi Bearings", km: 2.4, price: 940, source: "demo" },
          { id: "annai", name: "Annai Motors", km: 3.1, price: 1100, source: "demo" }
        ],
        logs: [
          { tag: "due", title: "Lubrication PM", detail: "Due 1 day ago", age: null }
        ]
      },
      {
        id: "m03",
        code: "M-03",
        name: "Industrial Compressor #01",
        bay: "Bay A",
        line: "Line 1",
        node: "ESP32-NODE-03",
        partName: "Vibration sensor",
        sku: "MPU-6050",
        priceSource: "demo",
        downtimeLoss: 0,
        sampleProfile: "loaded",
        profiles: [
          { id: "loaded", label: "profileLoaded", match: true, baseline: { temp: 57, vib: 2.2, current: 7.1 } }
        ],
        hammer: { baselineHz: 140, sampleHz: 141, loose: false },
        age: null,
        sensors: {
          temp: { value: 58, unit: "°C", min: 40, max: 75, hw: "PT100", name: "Bearing temp" },
          vib: { value: 8.6, unit: "mm/s", max: 4.5, hw: "MPU6050", name: "Vibration" },
          current: { value: 7.4, unit: "A", rated: 11, hw: "ACS712", name: "Motor load" }
        },
        shops: [
          { id: "murugan", name: "Sri Murugan Spares", km: 1.2, price: 180, source: "demo" },
          { id: "lakshmi", name: "Lakshmi Bearings", km: 2.4, price: 210, source: "demo" },
          { id: "annai", name: "Annai Motors", km: 3.1, price: 250, source: "demo" }
        ],
        logs: [
          { tag: "info", title: "Vibration channel", detail: "Disagrees with temperature and current", age: null }
        ]
      }
    ]
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
