// Scriptable widget suite — live, theme-matched widgets beyond the clock:
// weather (keyless Open-Meteo), calendar (real events), photo album (locally
// cached picks), countdown (widget-parameter driven). Each taps through to
// its matching stock app via a device-verified URL scheme.
import { shade } from './svg.js';

const sanitize = (s) => s.replace(/[^\w\- ]/g, '').trim().replace(/\s+/g, '-') || 'pack';

function theme(pack) {
  const s = pack.style;
  return {
    c1: s.c1,
    c2: s.bgType === 'solid' ? shade(s.c1, -0.35) : (s.c2 ?? s.c1),
    fg: s.glyphColor,
  };
}

const bgBlock = (t) => `const g = new LinearGradient()
g.colors = [new Color(${JSON.stringify(t.c1)}), new Color(${JSON.stringify(t.c2)})]
g.locations = [0, 1]
w.backgroundGradient = g
const FG = new Color(${JSON.stringify(t.fg)})
const DIM = new Color(${JSON.stringify(t.fg)}, 0.65)`;

const wrap = (pack, kind, glyph, script) => ({
  filename: `${sanitize(pack.name)}-${kind}.scriptable`,
  content: JSON.stringify(
    {
      always_run_in_app: false,
      icon: { color: 'deep-gray', glyph },
      name: `${pack.name} ${kind}`,
      script,
      share_sheet_inputs: [],
    },
    null,
    2
  ),
});

// ---------------------------------------------------------------------------
export function weatherWidget(pack) {
  const t = theme(pack);
  const script = `// ${pack.name} — weather widget (Open-Meteo, no API key)
// First run asks for location permission. Tap opens the Weather app.
const w = new ListWidget()
w.url = "weather://"
w.setPadding(16, 16, 16, 16)
${bgBlock(t)}

const CODES = {0:["sun.max.fill","Clear"],1:["sun.min.fill","Mostly clear"],2:["cloud.sun.fill","Partly cloudy"],3:["cloud.fill","Overcast"],45:["cloud.fog.fill","Fog"],48:["cloud.fog.fill","Fog"],51:["cloud.drizzle.fill","Drizzle"],53:["cloud.drizzle.fill","Drizzle"],55:["cloud.drizzle.fill","Drizzle"],61:["cloud.rain.fill","Rain"],63:["cloud.rain.fill","Rain"],65:["cloud.heavyrain.fill","Heavy rain"],71:["cloud.snow.fill","Snow"],73:["cloud.snow.fill","Snow"],75:["snowflake","Heavy snow"],80:["cloud.rain.fill","Showers"],81:["cloud.rain.fill","Showers"],82:["cloud.heavyrain.fill","Showers"],95:["cloud.bolt.fill","Storm"],96:["cloud.bolt.rain.fill","Storm"],99:["cloud.bolt.rain.fill","Storm"]}

try {
  Location.setAccuracyToKilometer()
  const loc = await Location.current()
  const url = \`https://api.open-meteo.com/v1/forecast?latitude=\${loc.latitude}&longitude=\${loc.longitude}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto\`
  const d = await new Request(url).loadJSON()
  const [sym, label] = CODES[d.current.weather_code] ?? ["cloud.fill", "Weather"]
  const top = w.addStack()
  top.centerAlignContent()
  const icon = top.addImage((SFSymbol.named(sym) ?? SFSymbol.named("cloud.fill")).image)
  icon.imageSize = new Size(30, 30)
  icon.tintColor = FG
  top.addSpacer(10)
  const temp = top.addText(Math.round(d.current.temperature_2m) + "°")
  temp.font = Font.boldSystemFont(34)
  temp.textColor = FG
  w.addSpacer(6)
  const cond = w.addText(label)
  cond.font = Font.mediumSystemFont(13)
  cond.textColor = DIM
  w.addSpacer()
  const hilo = w.addText(\`H \${Math.round(d.daily.temperature_2m_max[0])}°  L \${Math.round(d.daily.temperature_2m_min[0])}°\`)
  hilo.font = Font.mediumSystemFont(12)
  hilo.textColor = DIM
} catch (e) {
  const err = w.addText("Weather unavailable")
  err.font = Font.mediumSystemFont(13)
  err.textColor = DIM
}

Script.setWidget(w)
Script.complete()
if (config.runsInApp) { w.presentSmall() }
`;
  return wrap(pack, 'Weather', 'cloud', script);
}

// ---------------------------------------------------------------------------
export function calendarWidget(pack) {
  const t = theme(pack);
  const script = `// ${pack.name} — calendar widget (today + upcoming events)
// First run asks for calendar permission. Tap opens the Calendar app.
const w = new ListWidget()
w.url = "calshow://"
w.setPadding(16, 16, 16, 16)
${bgBlock(t)}

const now = new Date()
const df = new DateFormatter()
df.dateFormat = "EEEE"
const head = w.addText(df.string(now).toUpperCase())
head.font = Font.mediumSystemFont(11)
head.textColor = DIM
const day = w.addText(String(now.getDate()))
day.font = Font.boldSystemFont(30)
day.textColor = FG
w.addSpacer(8)

try {
  const events = (await CalendarEvent.today([]))
    .filter((e) => e.endDate > now)
    .slice(0, config.widgetFamily === "small" ? 2 : 3)
  if (events.length === 0) {
    const none = w.addText("No more events today")
    none.font = Font.mediumSystemFont(12)
    none.textColor = DIM
  }
  const tf = new DateFormatter()
  tf.useShortTimeStyle()
  for (const e of events) {
    const row = w.addStack()
    row.centerAlignContent()
    const dot = row.addText("●")
    dot.font = Font.systemFont(7)
    dot.textColor = FG
    row.addSpacer(6)
    const title = row.addText(e.title)
    title.font = Font.mediumSystemFont(12)
    title.textColor = FG
    title.lineLimit = 1
    row.addSpacer()
    const when = row.addText(e.isAllDay ? "all day" : tf.string(e.startDate))
    when.font = Font.mediumSystemFont(11)
    when.textColor = DIM
    w.addSpacer(4)
  }
} catch (e) {
  const err = w.addText("Allow calendar access in Scriptable")
  err.font = Font.mediumSystemFont(12)
  err.textColor = DIM
}
w.addSpacer()

Script.setWidget(w)
Script.complete()
if (config.runsInApp) { w.presentMedium() }
`;
  return wrap(pack, 'Calendar', 'calendar', script);
}

// ---------------------------------------------------------------------------
export function photoWidget(pack) {
  const t = theme(pack);
  const script = `// ${pack.name} — photo album widget
// Widgets can't browse your library, so: RUN THIS IN THE SCRIPTABLE APP
// first — it lets you pick photos and caches them. The widget then rotates
// through your picks on each refresh. Tap opens the Photos app.
const FOLDER = ${JSON.stringify(sanitize(pack.name) + '-photos')}
const fm = FileManager.local()
const dir = fm.joinPath(fm.documentsDirectory(), FOLDER)
if (!fm.isDirectory(dir)) fm.createDirectory(dir, true)

if (config.runsInApp) {
  // seeding mode: keep picking photos until Cancel
  let added = 0
  while (true) {
    try {
      const img = await Photos.fromLibrary()
      fm.writeImage(fm.joinPath(dir, "photo-" + Date.now() + ".jpg"), img)
      added++
    } catch (e) { break } // user cancelled the picker
  }
  const a = new Alert()
  a.title = "Photo album"
  a.message = added + " photo(s) added. " + fm.listContents(dir).length + " total. Add the widget and choose this script."
  a.addAction("OK")
  await a.present()
}

const w = new ListWidget()
w.url = "photos-redirect://"
${bgBlock(t)}

const files = fm.listContents(dir).filter((f) => f.endsWith(".jpg"))
if (files.length > 0) {
  const pick = files[Math.floor(Math.random() * files.length)]
  w.backgroundImage = fm.readImage(fm.joinPath(dir, pick))
  w.setPadding(0, 0, 0, 0)
  // theme-tinted footer band so it still reads as part of the pack
  w.addSpacer()
  const band = w.addStack()
  band.setPadding(6, 12, 8, 12)
  band.backgroundColor = new Color(${JSON.stringify(t.c1)}, 0.55)
  band.cornerRadius = 10
  const name = band.addText(${JSON.stringify(pack.name)})
  name.font = Font.mediumSystemFont(10)
  name.textColor = FG
  band.addSpacer()
} else {
  w.setPadding(16, 16, 16, 16)
  w.addSpacer()
  const hint = w.addText("Run this script in the Scriptable app to add photos")
  hint.font = Font.mediumSystemFont(12)
  hint.textColor = DIM
  hint.centerAlignText()
  w.addSpacer()
}

Script.setWidget(w)
Script.complete()
`;
  return wrap(pack, 'Photos', 'image', script);
}

// ---------------------------------------------------------------------------
export function countdownWidget(pack) {
  const t = theme(pack);
  const script = `// ${pack.name} — countdown widget
// Configure without editing code: long-press the widget -> Edit Widget ->
// Parameter -> "Trip to Goa|2026-12-20". Tap opens Calendar.
const param = args.widgetParameter || "New Year|2027-01-01"
const [label, dateStr] = param.split("|").map((s) => s.trim())
const target = new Date(dateStr + "T00:00:00")
const days = Math.max(0, Math.ceil((target - new Date()) / 86400000))

const w = new ListWidget()
w.url = "calshow://"
w.setPadding(16, 16, 16, 16)
${bgBlock(t)}

w.addSpacer()
const n = w.addText(String(days))
n.font = Font.boldSystemFont(44)
n.textColor = FG
n.centerAlignText()
n.minimumScaleFactor = 0.5
const unit = w.addText(days === 1 ? "day to go" : "days to go")
unit.font = Font.mediumSystemFont(12)
unit.textColor = DIM
unit.centerAlignText()
w.addSpacer(8)
const what = w.addText(label)
what.font = Font.semiboldSystemFont(13)
what.textColor = FG
what.centerAlignText()
what.lineLimit = 1
w.addSpacer()

Script.setWidget(w)
Script.complete()
if (config.runsInApp) { w.presentSmall() }
`;
  return wrap(pack, 'Countdown', 'hourglass', script);
}

export const SUITE = [
  ['Weather', weatherWidget],
  ['Calendar', calendarWidget],
  ['Photo album', photoWidget],
  ['Countdown', countdownWidget],
];
