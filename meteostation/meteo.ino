/*
  MeteoStation ESP32
  -----------------------------------------------------------------
  Режим 1 (AP/Captive Portal):
    Создаёт точку доступа "MeteoStation_Setup"
    DNS redirect - браузер телефона автоматически открывает портал
    Портал: список Wi-Fi сетей, поля SSID/пароль, кнопка GPS
    После ввода данных - подключается к интернету (STA)

  Режим 2 (STA, подключён):
    Авто-отправка данных каждые 30 минут на FMIS API
    Ручная отправка по кнопке на портале

  Датчики: BME280 (I2C), DS18B20 (OneWire), RTC DS3231
  -----------------------------------------------------------------
*/

#include <Wire.h>
#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <Adafruit_BME280.h>
#include <RTClib.h>
#include <OneWire.h>
#include <DallasTemperature.h>

/* --- пины --- */
#define PIN_DS18B20  13
#define SDA_PIN      21
#define SCL_PIN      22
#define PIN_RELAY    26    // GPIO реле (JQC3F-05VDC-C)

// true = активный LOW (большинство китайских модулей)
// false = активный HIGH
#define RELAY_ACTIVE_LOW true

/* --- AP настройки --- */
const char* AP_SSID     = "MeteoStation_Setup";
const char* AP_PASSWORD = "";
const IPAddress AP_IP(192, 168, 4, 1);
const IPAddress AP_SUBNET(255, 255, 255, 0);

/* --- FMIS API --- */
// Замените на реальный URL вашего сервера Vercel
const char* FMIS_API_URL = "https://fmis-admin-panel.vercel.app/api/meteostation";

/* --- Авто-отправка --- */
const uint32_t AUTO_SEND_INTERVAL = 30UL * 60UL * 1000UL;  // 30 минут
uint32_t lastAutoSend = 0;

// forward declaration
bool postToFmis();

/* --- объекты --- */
Adafruit_BME280   bme;
RTC_DS3231        rtc;
OneWire           ow(PIN_DS18B20);
DallasTemperature ds(&ow);
WebServer         server(80);
DNSServer         dns;
Preferences       prefs;

bool   bme_ok    = false;
bool   connected = false;
float  stationLat  = 0.0;
float  stationLng  = 0.0;
String stationName = "Meteostation";

// Кешированные показания DS18B20 (обновляются каждые 10 сек)
float  cachedSoil   = -999.0f;
bool   cachedSoilOk = false;
uint32_t lastSoilRead = 0;

// Реле
bool relayOn = false;

void setRelay(bool on) {
  relayOn = on;
  digitalWrite(PIN_RELAY, RELAY_ACTIVE_LOW ? !on : on);
  Serial.println(on ? "RELAY: ON" : "RELAY: OFF");
}

// Расписание реле
#define MAX_SCHEDULES 4
struct RelaySchedule {
  bool    enabled;
  uint8_t onH,  onM;
  uint8_t offH, offM;
};
RelaySchedule schedules[MAX_SCHEDULES];

void loadSchedules() {
  prefs.begin("relay", true);
  for (int i = 0; i < MAX_SCHEDULES; i++) {
    char ke[5], kon[6], kof[6];
    snprintf(ke,  sizeof(ke),  "s%de",  i);
    snprintf(kon, sizeof(kon), "s%don", i);
    snprintf(kof, sizeof(kof), "s%dof", i);
    schedules[i].enabled = prefs.getBool(ke, false);
    int on  = prefs.getInt(kon, 600);
    int off = prefs.getInt(kof, 700);
    schedules[i].onH  = on  / 100; schedules[i].onM  = on  % 100;
    schedules[i].offH = off / 100; schedules[i].offM = off % 100;
  }
  prefs.end();
}

void saveSchedules() {
  prefs.begin("relay", false);
  for (int i = 0; i < MAX_SCHEDULES; i++) {
    char ke[5], kon[6], kof[6];
    snprintf(ke,  sizeof(ke),  "s%de",  i);
    snprintf(kon, sizeof(kon), "s%don", i);
    snprintf(kof, sizeof(kof), "s%dof", i);
    prefs.putBool(ke,  schedules[i].enabled);
    prefs.putInt(kon,  schedules[i].onH  * 100 + schedules[i].onM);
    prefs.putInt(kof,  schedules[i].offH * 100 + schedules[i].offM);
  }
  prefs.end();
}

void checkSchedules() {
  DateTime now = rtc.now();
  int h = now.hour(), m = now.minute();
  for (int i = 0; i < MAX_SCHEDULES; i++) {
    if (!schedules[i].enabled) continue;
    if (h == schedules[i].onH  && m == schedules[i].onM)  setRelay(true);
    if (h == schedules[i].offH && m == schedules[i].offM) setRelay(false);
  }
}

/* =================================================================
   ДАТЧИКИ
   ================================================================= */
struct SensorData {
  float  tempAir, humidity, pressure, soilTemp;
  bool   soilOk;
  String timeStr;
};

/* Обновляем DS18B20 в фоне — вызывается из loop() каждые 10 сек */
void updateSoilTemp() {
  ds.requestTemperatures();
  // 9-бит → конверсия ~94 мс, ждём явно
  delay(100);
  float t = ds.getTempCByIndex(0);
  if (t > -100.0f && t < 85.0f) {
    cachedSoil   = t;
    cachedSoilOk = true;
  } else {
    // retry один раз
    ds.requestTemperatures();
    delay(110);
    t = ds.getTempCByIndex(0);
    cachedSoil   = t;
    cachedSoilOk = (t > -100.0f && t < 85.0f);
  }
  lastSoilRead = millis();
  Serial.printf("Soil: %.1f C  ok=%d\n", cachedSoil, cachedSoilOk);
}

SensorData readSensors() {
  SensorData d;
  if (bme_ok) {
    d.tempAir  = bme.readTemperature();
    d.humidity = bme.readHumidity();
    d.pressure = bme.readPressure() / 100.0F;
  } else {
    d.tempAir = d.humidity = d.pressure = 0;
  }
  // Используем кешированное значение — не блокируем loop()
  d.soilTemp = cachedSoil;
  d.soilOk   = cachedSoilOk;

  DateTime now = rtc.now();
  char buf[24];
  snprintf(buf, sizeof(buf), "%04d-%02d-%02dT%02d:%02d:%02d",
           now.year(), now.month(), now.day(),
           now.hour(), now.minute(), now.second());
  d.timeStr = String(buf);
  return d;
}

String sensorJson(const SensorData& d) {
  String j = "{";
  j += "\"temp\":"     + String(d.tempAir,  1) + ",";
  j += "\"humidity\":" + String(d.humidity, 1) + ",";
  j += "\"pressure\":" + String(d.pressure, 1) + ",";
  j += "\"soil\":"     + (d.soilOk ? String(d.soilTemp, 1) : String("null")) + ",";
  j += "\"lat\":"      + String(stationLat, 6) + ",";
  j += "\"lng\":"      + String(stationLng, 6) + ",";
  j += "\"name\":\""   + stationName + "\",";
  j += "\"time\":\""   + d.timeStr + "\"";
  j += "}";
  return j;
}

/* =================================================================
   HTML
   ВАЖНО: делимитер R"~( ... )~" — строка заканчивается ТОЛЬКО на )~"
   Это позволяет содержать onclick="func()" без преждевременного
   завершения строки.
   ================================================================= */
String htmlHead(const String& title) {
  return String(R"~(<!DOCTYPE html><html lang="ru"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>)~") + title + R"~(</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;padding:16px}
h1{font-size:1.3rem;font-weight:700;color:#4ade80;margin-bottom:4px}
.sub{color:#94a3b8;font-size:.8rem;margin-bottom:20px}
.card{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:16px;margin-bottom:16px}
label{display:block;font-size:.75rem;color:#94a3b8;margin-bottom:4px;margin-top:10px}
input{width:100%;padding:8px 10px;background:#0f172a;border:1px solid #475569;
border-radius:8px;color:#e2e8f0;font-size:.9rem;outline:none}
input:focus{border-color:#4ade80}
button{display:block;width:100%;padding:11px;margin-top:12px;border:none;border-radius:8px;
font-size:.95rem;font-weight:600;cursor:pointer;transition:.2s}
.btn-green{background:#16a34a;color:#fff}.btn-green:hover{background:#15803d}
.btn-blue{background:#2563eb;color:#fff}.btn-blue:hover{background:#1d4ed8}
.btn-gray{background:#334155;color:#e2e8f0}
.badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:.7rem;font-weight:600;background:#334155;color:#94a3b8}
.badge-green{background:#14532d;color:#4ade80}
.net-item{display:flex;justify-content:space-between;align-items:center;
padding:8px 0;border-bottom:1px solid #334155;cursor:pointer}
.net-item:hover{color:#4ade80}
.rssi{font-size:.75rem;color:#64748b}
.sensor-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px}
.sensor-box{background:#0f172a;border-radius:8px;padding:10px;text-align:center}
.sensor-val{font-size:1.4rem;font-weight:700;color:#4ade80}
.sensor-lbl{font-size:.7rem;color:#94a3b8;margin-top:2px}
#status,#sendStatus{margin-top:12px;padding:10px;border-radius:8px;font-size:.85rem;display:none}
.info{background:#1e3a5f;color:#93c5fd}
.success{background:#14532d;color:#4ade80}
.error{background:#450a0a;color:#f87171}
</style></head><body>
)~";
}

/* -- Страница настройки WiFi (captive portal) -- */
String pageSetup() {
  String html = htmlHead("MeteoStation Setup");
  html += R"~(
<h1>MeteoStation</h1>
<p class="sub">Wi-Fi Setup</p>

<div class="card">
  <div style="display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:.85rem;font-weight:600">Available Wi-Fi networks</span>
    <button class="btn-gray" id="btnScan"
      style="width:auto;padding:5px 12px;font-size:.75rem;margin:0">Scan</button>
  </div>
  <div id="netList" style="margin-top:10px">
    <p style="color:#64748b;font-size:.8rem">Scanning...</p>
  </div>
</div>

<div class="card">
  <span style="font-size:.85rem;font-weight:600">Connection</span>
  <label>Network name (SSID)</label>
  <input id="ssid" type="text" placeholder="Select above or type here">
  <label>Password</label>
  <input id="pass" type="password" placeholder="Wi-Fi password">
  <label>Station name</label>
  <input id="sname" type="text" value="Meteostation" placeholder="Station label">
  <label>GPS coordinates</label>
  <div style="display:flex;gap:8px;margin-top:4px">
    <input id="lat" type="number" step="0.000001" placeholder="Latitude"  style="flex:1">
    <input id="lng" type="number" step="0.000001" placeholder="Longitude" style="flex:1">
  </div>
  <button class="btn-blue" id="btnGps">Get GPS from phone</button>
  <div id="status"></div>
  <button class="btn-green" id="btnConn">Connect</button>
</div>

<script>
function showStatus(msg, cls) {
  var s = document.getElementById('status');
  s.textContent = msg; s.className = cls; s.style.display = 'block';
}

document.getElementById('btnGps').onclick = function() {
  showStatus('Requesting GPS...', 'info');
  if (!navigator.geolocation) { showStatus('GPS not available', 'error'); return; }
  navigator.geolocation.getCurrentPosition(function(pos) {
    document.getElementById('lat').value = pos.coords.latitude.toFixed(6);
    document.getElementById('lng').value = pos.coords.longitude.toFixed(6);
    showStatus('Coordinates: ' + pos.coords.latitude.toFixed(4) + ', ' + pos.coords.longitude.toFixed(4), 'success');
  }, function(e) {
    showStatus('GPS error: ' + e.message, 'error');
  }, {enableHighAccuracy: true, timeout: 10000});
};

function scanWifi() {
  document.getElementById('netList').innerHTML = '<p style="color:#64748b;font-size:.8rem">Scanning...</p>';
  fetch('/scan').then(function(r){ return r.json(); }).then(function(nets) {
    if (!nets.length) {
      document.getElementById('netList').innerHTML = '<p style="color:#64748b;font-size:.8rem">No networks found</p>';
      return;
    }
    var html = '';
    for (var i = 0; i < nets.length; i++) {
      var n = nets[i];
      var bars = n.rssi > -60 ? '||||' : n.rssi > -75 ? '|||' : n.rssi > -85 ? '||' : '|';
      var lock = n.secure ? ' [lock]' : '';
      var ssid = n.ssid.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      html += '<div class="net-item" id="net' + i + '">'
            + '<span>' + n.ssid + lock + '</span>'
            + '<span class="rssi">' + bars + ' ' + n.rssi + 'dBm</span></div>';
    }
    document.getElementById('netList').innerHTML = html;
    for (var i = 0; i < nets.length; i++) {
      (function(name) {
        document.getElementById('net' + i).onclick = function() {
          document.getElementById('ssid').value = name;
        };
      })(nets[i].ssid);
    }
  }).catch(function() {
    document.getElementById('netList').innerHTML = '<p style="color:#f87171;font-size:.8rem">Scan failed</p>';
  });
}

document.getElementById('btnScan').onclick = scanWifi;

document.getElementById('btnConn').onclick = function() {
  var ssid = document.getElementById('ssid').value.trim();
  var pass = document.getElementById('pass').value;
  var lat  = document.getElementById('lat').value;
  var lng  = document.getElementById('lng').value;
  var name = document.getElementById('sname').value.trim() || 'Meteostation';
  if (!ssid) { showStatus('Enter network name', 'error'); return; }
  showStatus('Connecting...', 'info');
  var body = 'ssid=' + encodeURIComponent(ssid)
           + '&pass=' + encodeURIComponent(pass)
           + '&lat='  + encodeURIComponent(lat)
           + '&lng='  + encodeURIComponent(lng)
           + '&name=' + encodeURIComponent(name);
  fetch('/connect', {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: body})
    .then(function(r){ return r.json(); }).then(function(res) {
      if (res.ok) showStatus('Connected! Open sensor page.', 'success');
      else        showStatus('Failed: ' + res.msg, 'error');
    }).catch(function() { showStatus('No response from device', 'error'); });
};

scanWifi();
</script>
)~";
  return html + "</body></html>";
}

/* -- Страница данных датчиков (STA режим) -- */
String pageSensors() {
  SensorData d = readSensors();
  uint32_t elapsed = (millis() - lastAutoSend) / 1000;
  uint32_t remain  = (AUTO_SEND_INTERVAL / 1000 > elapsed)
                     ? (AUTO_SEND_INTERVAL / 1000 - elapsed) : 0;

  String html = htmlHead("MeteoStation Data");

  html += R"~(
<h1>MeteoStation</h1>
<p class="sub">)~" + stationName + R"~(</p>

<div class="card">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    <span style="font-size:.85rem;font-weight:600">Sensor readings</span>
    <span class="badge badge-green">ONLINE</span>
  </div>
  <div class="sensor-grid">
    <div class="sensor-box">
      <div class="sensor-val" id="vTemp">)~" + String(d.tempAir, 1) + R"~(C</div>
      <div class="sensor-lbl">Air temperature</div>
    </div>
    <div class="sensor-box">
      <div class="sensor-val" id="vHum">)~" + String(d.humidity, 1) + R"~(%</div>
      <div class="sensor-lbl">Humidity</div>
    </div>
    <div class="sensor-box">
      <div class="sensor-val" id="vPress">)~" + String(d.pressure, 1) + R"~(</div>
      <div class="sensor-lbl">Pressure, hPa</div>
    </div>
    <div class="sensor-box">
      <div class="sensor-val" id="vSoil">)~"
    + (d.soilOk ? String(d.soilTemp, 1) + "C" : String("--"))
    + R"~(</div>
      <div class="sensor-lbl">Soil temperature</div>
    </div>
  </div>
  <p style="font-size:.7rem;color:#64748b;margin-top:8px;text-align:right" id="vTime">)~"
  + d.timeStr + R"~(</p>
</div>

<div class="card">
  <span style="font-size:.85rem;font-weight:600">Station location</span>
  <p style="font-size:.8rem;color:#94a3b8;margin-top:6px">
    Lat: )~" + String(stationLat, 6) + R"~( Lon: )~" + String(stationLng, 6) + R"~(
  </p>
</div>

<div class="card">
  <span style="font-size:.85rem;font-weight:600">Relay control (JQC3F)</span>
  <div style="display:flex;align-items:center;gap:12px;margin-top:10px">
    <span style="font-size:.8rem;color:#64748b">Status:</span>
    <span id="relayBadge" class=")~" + String(relayOn ? "badge badge-green" : "badge") + R"~(">
      )~" + String(relayOn ? "ON" : "OFF") + R"~(
    </span>
  </div>
  <div style="display:flex;gap:8px;margin-top:10px">
    <button class="btn-green" onclick="ctrlRelay('on')">Turn ON</button>
    <button class="btn-gray"  onclick="ctrlRelay('off')">Turn OFF</button>
    <button style="padding:8px 14px;border-radius:8px;border:1px solid #475569;background:#334155;color:#fff;cursor:pointer"
            onclick="ctrlRelay('toggle')">Toggle</button>
  </div>
</div>

<div class="card" id="schedCard">
  <span style="font-size:.85rem;font-weight:600">Relay schedule</span>
  <p style="font-size:.72rem;color:#64748b;margin:4px 0 10px">
    Реле включается/выключается автоматически по времени RTC.
  </p>
  <table style="width:100%;border-collapse:collapse;font-size:.78rem" id="schedTable">
    <thead>
      <tr style="color:#94a3b8">
        <th style="text-align:left;padding:4px 2px;width:30px">ON</th>
        <th style="padding:4px 6px">Включить</th>
        <th style="padding:4px 6px">Выключить</th>
      </tr>
    </thead>
    <tbody id="schedBody"></tbody>
  </table>
  <div id="schedStatus" style="display:none;margin-top:8px;font-size:.75rem"></div>
  <button class="btn-green" id="btnSaveSched" style="margin-top:10px">Save schedule</button>
</div>

<div class="card">
  <span style="font-size:.85rem;font-weight:600">Send to FMIS</span>
  <p style="font-size:.75rem;color:#64748b;margin-top:6px">
    Auto-send in: <span id="countdown">)~" + String(remain) + R"~(</span> sec
  </p>
  <div id="sendStatus"></div>
  <button class="btn-green" id="btnSend" style="margin-top:10px">Send now</button>
  <button class="btn-gray"  id="btnRef"  style="margin-top:8px">Refresh readings</button>
</div>

<script>
var countdown = )~" + String(remain) + R"~(;

// ── Расписание реле ──────────────────────────────────────────────
var schedData = [];

function renderSched() {
  var tb = document.getElementById('schedBody');
  tb.innerHTML = '';
  for (var i = 0; i < schedData.length; i++) {
    var s = schedData[i];
    tb.innerHTML +=
      '<tr>' +
      '<td style="padding:4px 2px"><input type="checkbox" id="se' + i + '"' +
        (s.e ? ' checked' : '') + '></td>' +
      '<td style="padding:4px 6px"><input type="time" id="son' + i + '" value="' + s.on + '"' +
        ' style="background:#1e293b;color:#e2e8f0;border:1px solid #475569;border-radius:6px;padding:3px 6px;width:100%"></td>' +
      '<td style="padding:4px 6px"><input type="time" id="sof' + i + '" value="' + s.off + '"' +
        ' style="background:#1e293b;color:#e2e8f0;border:1px solid #475569;border-radius:6px;padding:3px 6px;width:100%"></td>' +
      '</tr>';
  }
}

fetch('/relay/schedule')
  .then(function(r){ return r.json(); })
  .then(function(arr) {
    schedData = arr;
    renderSched();
  });

document.getElementById('btnSaveSched').onclick = function() {
  var payload = [];
  for (var i = 0; i < schedData.length; i++) {
    payload.push({
      e:   document.getElementById('se'  + i).checked,
      on:  document.getElementById('son' + i).value,
      off: document.getElementById('sof' + i).value
    });
  }
  var st = document.getElementById('schedStatus');
  st.textContent = 'Saving...'; st.className = 'info'; st.style.display = 'block';
  fetch('/relay/schedule', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  }).then(function(r){ return r.json(); }).then(function(res) {
    st.textContent = res.ok ? 'Saved!' : 'Error';
    st.className   = res.ok ? 'success' : 'error';
  }).catch(function() {
    st.textContent = 'No response'; st.className = 'error';
  });
};

// ── Управление реле вручную ───────────────────────────────────────
function ctrlRelay(state) {
  fetch('/relay?state=' + state)
    .then(function(r){ return r.json(); }).then(function(res) {
      var badge = document.getElementById('relayBadge');
      badge.textContent = res.relay ? 'ON' : 'OFF';
      badge.className   = res.relay ? 'badge badge-green' : 'badge';
    }).catch(function() { alert('Relay error'); });
}

document.getElementById('btnSend').onclick = function() {
  var s = document.getElementById('sendStatus');
  s.textContent = 'Sending...'; s.className = 'info'; s.style.display = 'block';
  fetch('/send', {method:'POST'})
    .then(function(r){ return r.json(); }).then(function(res) {
      if (res.ok) { s.textContent = 'Sent to FMIS successfully'; s.className = 'success'; countdown = 1800; }
      else        { s.textContent = 'Error: ' + res.msg; s.className = 'error'; }
      s.style.display = 'block';
    }).catch(function() {
      s.textContent = 'No response'; s.className = 'error'; s.style.display = 'block';
    });
};

document.getElementById('btnRef').onclick = function() { location.reload(); };

// Countdown
setInterval(function() {
  if (countdown > 0) countdown--;
  var m = Math.floor(countdown / 60), s = countdown % 60;
  document.getElementById('countdown').textContent =
    (m > 0 ? m + 'm ' : '') + s + 's';
}, 1000);

// Auto-refresh readings every 15 sec
setInterval(function() {
  fetch('/api/sensors').then(function(r){ return r.json(); }).then(function(d) {
    document.getElementById('vTemp').textContent  = d.temp + 'C';
    document.getElementById('vHum').textContent   = d.humidity + '%';
    document.getElementById('vPress').textContent = d.pressure;
    document.getElementById('vSoil').textContent  = d.soil !== null ? d.soil + 'C' : '--';
    document.getElementById('vTime').textContent  = d.time;
  });
}, 15000);
</script>
)~";
  return html + "</body></html>";
}

/* =================================================================
   МАРШРУТЫ
   ================================================================= */
void handleRoot() {
  if (connected) server.send(200, "text/html", pageSensors());
  else           server.send(200, "text/html", pageSetup());
}

void handleCaptive() {
  server.sendHeader("Location", "http://192.168.4.1/", true);
  server.send(302, "text/plain", "");
}

void handleScan() {
  int n = WiFi.scanNetworks();
  String json = "[";
  for (int i = 0; i < n; i++) {
    if (i) json += ",";
    String ssid = WiFi.SSID(i);
    ssid.replace("\"", "\\\"");
    json += "{\"ssid\":\"" + ssid + "\","
            "\"rssi\":"  + String(WiFi.RSSI(i)) + ","
            "\"secure\":" + (WiFi.encryptionType(i) != WIFI_AUTH_OPEN ? "true" : "false") + "}";
  }
  json += "]";
  server.send(200, "application/json", json);
}

void handleConnect() {
  String ssid = server.arg("ssid");
  String pass = server.arg("pass");
  String lat  = server.arg("lat");
  String lng  = server.arg("lng");
  String name = server.arg("name");

  if (lat.length())  stationLat  = lat.toFloat();
  if (lng.length())  stationLng  = lng.toFloat();
  if (name.length()) stationName = name;

  prefs.begin("meteo", false);
  prefs.putString("ssid", ssid);
  prefs.putString("pass", pass);
  prefs.putFloat("lat",   stationLat);
  prefs.putFloat("lng",   stationLng);
  prefs.putString("name", stationName);
  prefs.end();

  WiFi.begin(ssid.c_str(), pass.c_str());
  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) delay(300);

  if (WiFi.status() == WL_CONNECTED) {
    connected = true;
    server.send(200, "application/json", "{\"ok\":true}");
    Serial.println("WiFi connected: " + WiFi.localIP().toString());
    // Отправить первые данные сразу после подключения
    delay(500);
    postToFmis();
    lastAutoSend = millis();
  } else {
    server.send(200, "application/json",
      "{\"ok\":false,\"msg\":\"Cannot connect. Check password.\"}");
  }
}

void handleSensorApi() {
  SensorData d = readSensors();
  server.send(200, "application/json", sensorJson(d));
}

void handleSend() {
  if (!connected) {
    server.send(200, "application/json", "{\"ok\":false,\"msg\":\"No internet\"}");
    return;
  }
  SensorData d = readSensors();
  String body = sensorJson(d);
  HTTPClient http;
  http.begin(FMIS_API_URL);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(body);
  String resp = http.getString();
  http.end();
  // Успех только если HTTP 200 и тело содержит "ok":true
  bool ok = (code == 200 && resp.indexOf("\"ok\":true") >= 0);
  if (ok) lastAutoSend = millis();
  Serial.println("ManualSend HTTP " + String(code) + " -> " + resp);
  server.send(200, "application/json",
    ok ? "{\"ok\":true}" : "{\"ok\":false,\"msg\":\"HTTP " + String(code) + ": " + resp + "\"}");
}

/* ── Расписание реле ─────────────────────────────────────────────── */
void handleRelayScheduleGet() {
  String j = "[";
  for (int i = 0; i < MAX_SCHEDULES; i++) {
    if (i) j += ",";
    char buf[80];
    snprintf(buf, sizeof(buf),
      "{\"e\":%s,\"on\":\"%02d:%02d\",\"off\":\"%02d:%02d\"}",
      schedules[i].enabled ? "true" : "false",
      schedules[i].onH, schedules[i].onM,
      schedules[i].offH, schedules[i].offM);
    j += buf;
  }
  j += "]";
  server.send(200, "application/json", j);
}

void handleRelaySchedulePost() {
  String body = server.arg("plain");
  // Ручной парсинг массива JSON-объектов без ArduinoJson
  int idx = 0, pos = 0;
  while (idx < MAX_SCHEDULES) {
    int s = body.indexOf('{', pos);
    int e = body.indexOf('}', s);
    if (s < 0 || e < 0) break;
    String obj = body.substring(s, e + 1);
    schedules[idx].enabled = (obj.indexOf("\"e\":true") >= 0);
    int onIdx  = obj.indexOf("\"on\":\"");
    int offIdx = obj.indexOf("\"off\":\"");
    if (onIdx >= 0) {
      String t = obj.substring(onIdx + 6, onIdx + 11);
      schedules[idx].onH = t.substring(0, 2).toInt();
      schedules[idx].onM = t.substring(3, 5).toInt();
    }
    if (offIdx >= 0) {
      String t = obj.substring(offIdx + 7, offIdx + 12);
      schedules[idx].offH = t.substring(0, 2).toInt();
      schedules[idx].offM = t.substring(3, 5).toInt();
    }
    pos = e + 1;
    idx++;
  }
  saveSchedules();
  server.send(200, "application/json", "{\"ok\":true}");
}

/* ── Управление реле ─────────────────────────────────────────────── */
void handleRelay() {
  String state = server.arg("state");  // ?state=on | ?state=off | ?state=toggle
  if (state == "on")          setRelay(true);
  else if (state == "off")    setRelay(false);
  else if (state == "toggle") setRelay(!relayOn);
  server.send(200, "application/json",
    String("{\"relay\":") + (relayOn ? "true" : "false") + "}");
}

/* =================================================================
   SETUP
   ================================================================= */
void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(PIN_RELAY, OUTPUT);
  setRelay(false);
  loadSchedules();

  Wire.begin(SDA_PIN, SCL_PIN);
  bme_ok = bme.begin(0x76) || bme.begin(0x77);
  rtc.begin();
  if (rtc.lostPower()) rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
  ds.begin();
  ds.setResolution(9);      // 9-бит: 93мс вместо 750мс
  updateSoilTemp();         // первое чтение сразу при старте

  prefs.begin("meteo", true);
  String savedSsid = prefs.getString("ssid", "");
  String savedPass = prefs.getString("pass", "");
  stationLat  = prefs.getFloat("lat",  0.0);
  stationLng  = prefs.getFloat("lng",  0.0);
  stationName = prefs.getString("name", "Meteostation");
  prefs.end();

  if (savedSsid.length()) {
    Serial.println("Connecting to: " + savedSsid);
    WiFi.mode(WIFI_AP_STA);
    WiFi.begin(savedSsid.c_str(), savedPass.c_str());
    uint32_t t = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - t < 12000) delay(300);
    if (WiFi.status() == WL_CONNECTED) {
      connected = true;
      Serial.println("Connected: " + WiFi.localIP().toString());
      postToFmis();         // первая отправка сразу при старте
      lastAutoSend = millis();
    }
  }

  WiFi.softAPConfig(AP_IP, AP_IP, AP_SUBNET);
  WiFi.softAP(AP_SSID, AP_PASSWORD);
  if (!connected) WiFi.mode(WIFI_AP);
  Serial.println("AP IP: " + WiFi.softAPIP().toString());

  dns.start(53, "*", AP_IP);

  server.on("/",             HTTP_GET,  handleRoot);
  server.on("/scan",         HTTP_GET,  handleScan);
  server.on("/connect",      HTTP_POST, handleConnect);
  server.on("/api/sensors",  HTTP_GET,  handleSensorApi);
  server.on("/send",         HTTP_POST, handleSend);
  server.on("/relay",            HTTP_GET,  handleRelay);
  server.on("/relay/schedule",   HTTP_GET,  handleRelayScheduleGet);
  server.on("/relay/schedule",   HTTP_POST, handleRelaySchedulePost);

  server.on("/generate_204",        HTTP_GET, handleCaptive);
  server.on("/hotspot-detect.html", HTTP_GET, handleCaptive);
  server.on("/connecttest.txt",     HTTP_GET, handleCaptive);
  server.on("/ncsi.txt",            HTTP_GET, handleCaptive);
  server.on("/redirect",            HTTP_GET, handleCaptive);
  server.onNotFound(handleRoot);

  server.begin();
  Serial.println("HTTP server started");
  Serial.println("READY");
}

/* =================================================================
   LOOP
   ================================================================= */
bool postToFmis() {
  if (!connected) return false;
  SensorData d = readSensors();
  String body = sensorJson(d);
  HTTPClient http;
  http.begin(FMIS_API_URL);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(body);
  String resp = http.getString();
  http.end();
  bool ok = (code == 200 && resp.indexOf("\"ok\":true") >= 0);
  Serial.println("AutoSend HTTP " + String(code) + " -> " + resp);
  return ok;
}

void loop() {
  dns.processNextRequest();
  server.handleClient();

  if (connected && (millis() - lastAutoSend >= AUTO_SEND_INTERVAL)) {
    lastAutoSend = millis();
    postToFmis();
  }

  // Проверяем расписание реле раз в минуту
  {
    static uint8_t lastSchedMin = 255;
    DateTime now = rtc.now();
    if (now.minute() != lastSchedMin) {
      lastSchedMin = now.minute();
      checkSchedules();
    }
  }

  // Обновляем DS18B20 каждые 10 сек
  if (millis() - lastSoilRead > 10000) {
    updateSoilTemp();
  }

  // Serial отладка каждые 5 сек
  static uint32_t t0 = 0;
  if (millis() - t0 > 5000) {
    t0 = millis();
    SensorData d = readSensors();
    Serial.println(sensorJson(d));
  }
}
