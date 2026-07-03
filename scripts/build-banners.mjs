import sharp from "sharp"

const LOGO_W = 907
const LOGO_H = 262
const ASPECT = LOGO_H / LOGO_W

async function build({ out, W, H, logoWidth, x }) {
  const bgName = out.includes("facebook") ? "_bg-facebook.png" : "_bg-linkedin.png"

  const bg = await sharp(`public/social/${bgName}`)
    .resize(W, H, { fit: "cover", position: "right" })
    .toBuffer()

  const logoH = Math.round(logoWidth * ASPECT)
  const logo = await sharp("public/beeserv-logo-white.png")
    .resize(logoWidth, logoH)
    .toBuffer()

  // The official logo already includes the "Serving Hospitality Operators"
  // tagline, so we composite it alone, vertically centered.
  const top = Math.round((H - logoH) / 2)

  await sharp(bg)
    .composite([{ input: logo, left: x, top }])
    .png()
    .toFile(out)

  console.log(`Built ${out} (${W}x${H})`)
}

await build({
  out: "public/social/beeserv-facebook-banner.png",
  W: 1702,
  H: 630,
  logoWidth: 760,
  x: 120,
})

await build({
  out: "public/social/beeserv-linkedin-banner.png",
  W: 1584,
  H: 396,
  logoWidth: 620,
  x: 110,
})

console.log("Done.")
