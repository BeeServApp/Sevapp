import sharp from "sharp"

const S = 1080 // square canvas
const LOGO_ASPECT = 262 / 907

function esc(t) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

// Render centered multi-line headline text as an SVG buffer.
function headlineSvg({ width, lines, fontSize, lineHeight, color, weight = 700, letter = 0 }) {
  const height = Math.ceil(lines.length * fontSize * lineHeight) + 20
  const tspans = lines
    .map((line, i) => {
      const dy = i === 0 ? fontSize : fontSize * lineHeight
      return `<tspan x="${width / 2}" dy="${i === 0 ? fontSize : fontSize * lineHeight}">${esc(line)}</tspan>`
    })
    .join("")
  return {
    buf: Buffer.from(
      `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
         <text text-anchor="middle" x="${width / 2}" y="0"
               font-family="Poppins, 'Segoe UI', Arial, sans-serif"
               font-size="${fontSize}" font-weight="${weight}"
               letter-spacing="${letter}" fill="${color}">${tspans}</text>
       </svg>`,
    ),
    height,
  }
}

// Small pill/eyebrow label
function eyebrowSvg({ text, fontSize, color, weight = 600, letter = 3 }) {
  const width = Math.ceil(text.length * fontSize * 0.72) + 40
  const height = fontSize + 20
  return {
    buf: Buffer.from(
      `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
         <text text-anchor="middle" x="${width / 2}" y="${fontSize}"
               font-family="Poppins, 'Segoe UI', Arial, sans-serif"
               font-size="${fontSize}" font-weight="${weight}"
               letter-spacing="${letter}" fill="${color}">${esc(text.toUpperCase())}</text>
       </svg>`,
    ),
    width,
    height,
  }
}

async function logoBuffer(variant, width) {
  const h = Math.round(width * LOGO_ASPECT)
  return {
    buf: await sharp(`public/beeserv-logo-${variant}.png`).resize(width, h).toBuffer(),
    w: width,
    h,
  }
}

async function iconBuffer(width) {
  return {
    buf: await sharp("public/beeserv-icon.png").resize(width, width).toBuffer(),
    w: width,
    h: width,
  }
}

// ---- Post 1: Brand / intro (navy, centered icon + logo) ----
async function buildBrand() {
  const bg = await sharp("public/social/_bg-post-1.png").resize(S, S, { fit: "cover" }).toBuffer()
  const icon = await iconBuffer(300)
  const logo = await logoBuffer("white", 620)

  const block = icon.h + 70 + logo.h
  let top = Math.round((S - block) / 2) - 10

  await sharp(bg)
    .composite([
      { input: icon.buf, left: Math.round((S - icon.w) / 2), top },
      { input: logo.buf, left: Math.round((S - logo.w) / 2), top: top + icon.h + 70 },
    ])
    .png()
    .toFile("public/social/beeserv-post-brand.png")
  console.log("Built beeserv-post-brand.png")
}

// ---- Post 2: Feature on navy w/ yellow band ----
async function buildFeatureNavy() {
  const bg = await sharp("public/social/_bg-post-2.png").resize(S, S, { fit: "cover" }).toBuffer()
  const icon = await iconBuffer(150)
  const logo = await logoBuffer("black", 300) // sits on yellow band

  const eyebrow = eyebrowSvg({ text: "Smart Scheduling", fontSize: 26, color: "#F5C518" })
  const headline = headlineSvg({
    width: 900,
    lines: ["Build the perfect", "rota in minutes"],
    fontSize: 84,
    lineHeight: 1.12,
    color: "#FFFFFF",
    weight: 700,
  })

  await sharp(bg)
    .composite([
      { input: icon.buf, left: 90, top: 90 },
      { input: eyebrow.buf, left: 90, top: 300 },
      { input: headline.buf, left: Math.round((S - 900) / 2), top: 360, gravity: "northwest" },
      { input: logo.buf, left: 90, top: S - 150 },
    ])
    .png()
    .toFile("public/social/beeserv-post-rotas.png")
  console.log("Built beeserv-post-rotas.png")
}

// ---- Post 3: Feature on yellow ----
async function buildFeatureYellow() {
  const bg = await sharp("public/social/_bg-post-3.png").resize(S, S, { fit: "cover" }).toBuffer()
  const logo = await logoBuffer("black", 300)

  const eyebrow = eyebrowSvg({ text: "Time & Attendance", fontSize: 26, color: "#23262E" })
  const headline = headlineSvg({
    width: 940,
    lines: ["Clock in. Track hours.", "Approve timecards."],
    fontSize: 76,
    lineHeight: 1.14,
    color: "#23262E",
    weight: 700,
  })

  const block = headline.height
  const top = Math.round((S - block) / 2)

  await sharp(bg)
    .composite([
      { input: eyebrow.buf, left: Math.round((S - eyebrow.width) / 2), top: top - 70 },
      { input: headline.buf, left: Math.round((S - 940) / 2), top },
      { input: logo.buf, left: Math.round((S - 300) / 2), top: S - 160 },
    ])
    .png()
    .toFile("public/social/beeserv-post-timecards.png")
  console.log("Built beeserv-post-timecards.png")
}

await buildBrand()
await buildFeatureNavy()
await buildFeatureYellow()
console.log("All posts built (1080x1080).")
