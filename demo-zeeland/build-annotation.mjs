// Build a IIIF Georeference Annotation from gcps.csv + mask.json.
// Spec: https://iiif.io/api/extension/georef/
//
//   node build-annotation.mjs
//
// Edit gcps.csv and re-run; annotation.json is generated and committed so the
// viewer works without Node.
import { readFileSync, writeFileSync } from 'node:fs'

// node build-annotation.mjs [1690|1663]
const MAPS = {
  1690: {
    id: 'https://iiif.micr.io/vVYKG',
    type: 'ImageService3',
    width: 8385,
    height: 5938
  },
  1663: {
    id: 'https://iiif.micr.io/BOjyb',
    type: 'ImageService3',
    width: 3768,
    height: 3122
  }
}

const KEY = process.argv[2] ?? '1690'
if (!MAPS[KEY]) {
  throw new Error(`Unknown map "${KEY}". Use one of: ${Object.keys(MAPS).join(', ')}`)
}
const IMAGE = MAPS[KEY]

// thinPlateSpline = 'rubber sheeting': exact at every GCP, absorbs the uneven
// distortion of a hand-engraved 17th-century chart. Swap for 'polynomial2' if
// the result looks too rubbery between control points.
const TRANSFORMATION = 'thinPlateSpline'

const csv = readFileSync(new URL(`./gcps-${KEY}.csv`, import.meta.url), 'utf8')
const [header, ...lines] = csv
  .trim()
  .split('\n')
  .filter((line) => line.trim() && !line.startsWith('#'))
const cols = header.split(',')

const gcps = lines.map((line) =>
  Object.fromEntries(line.split(',').map((v, i) => [cols[i], v]))
)

for (const { name, px, py, lon, lat } of gcps) {
  if ([px, py, lon, lat].some((v) => v === undefined || v === '' || isNaN(+v))) {
    throw new Error(`Bad row in gcps-${KEY}.csv: ${name}`)
  }
}
if (gcps.length < 3) throw new Error('Need at least 3 GCPs')

const { polygon } = JSON.parse(
  readFileSync(new URL(`./mask-${KEY}.json`, import.meta.url), 'utf8')
)
const points = polygon.map(([x, y]) => `${x},${y}`).join(' ')

const annotation = {
  '@context': [
    'http://iiif.io/api/extension/georef/1/context.json',
    'http://iiif.io/api/presentation/3/context.json'
  ],
  type: 'Annotation',
  motivation: 'georeferencing',
  target: {
    type: 'SpecificResource',
    source: IMAGE,
    selector: {
      type: 'SvgSelector',
      value: `<svg width="${IMAGE.width}" height="${IMAGE.height}"><polygon points="${points}" /></svg>`
    }
  },
  body: {
    type: 'FeatureCollection',
    transformation: { type: TRANSFORMATION },
    features: gcps.map(({ name, px, py, lon, lat }) => ({
      type: 'Feature',
      properties: { resourceCoords: [+px, +py], label: name },
      geometry: { type: 'Point', coordinates: [+lon, +lat] }
    }))
  }
}

writeFileSync(
  new URL(`./annotation-${KEY}.json`, import.meta.url),
  JSON.stringify(annotation, null, 2) + '\n'
)
console.log(`annotation-${KEY}.json written: ${gcps.length} GCPs, ${TRANSFORMATION}`)
