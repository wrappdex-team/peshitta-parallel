/**
 * Century styles for Stills: real art-historical traditions of Christian art.
 * Each prompt names the medium, palette and conventions of that tradition so a
 * model paints in it, not a pastiche. Dates are the tradition's high point.
 */
export type CenturyStyle = {
  id: string;
  name: string;
  era: string;
  /** Three swatch colours for the picker plate. */
  palette: [string, string, string];
  prompt: string;
};

export const STYLES: CenturyStyle[] = [
  {
    id: "catacomb",
    name: "Catacomb fresco",
    era: "3rd century · Rome",
    palette: ["#c9b28a", "#8c3b2a", "#5b6b4a"],
    prompt: "Early Christian catacomb wall painting, Catacomb of Priscilla, 3rd century: quick fresco brushwork on rough plaster, red and yellow ochre lines, simple figures in tunics, orant gestures, flat cream ground with faint cracks and flaking",
  },
  {
    id: "mosaic",
    name: "Byzantine mosaic",
    era: "6th century · Ravenna",
    palette: ["#c9a227", "#1f3f6b", "#e8dfc8"],
    prompt: "Byzantine mosaic, San Vitale Ravenna, 6th century: glass and gold tesserae, shimmering gold ground, frontal solemn figures with large eyes, deep blue and white robes, haloes, visible tessera grid",
  },
  {
    id: "rabbula",
    name: "Rabbula Gospels",
    era: "586 · Syriac",
    palette: ["#b5452c", "#2f5d50", "#e3cf9e"],
    prompt: "Syriac illuminated manuscript in the manner of the Rabbula Gospels (586 AD): vivid gouache on parchment, ornamental arch frames with columns and birds, bold outlines, saturated red, green and ochre, expressive Eastern Christian figures, margins of vellum",
  },
  {
    id: "icon",
    name: "Byzantine icon",
    era: "10th–12th century",
    palette: ["#d4a73a", "#7a1f1f", "#1d2f4f"],
    prompt: "Byzantine icon, Middle Byzantine period: egg tempera on gessoed wood panel, burnished gold leaf background, inverse perspective, elongated serene figures, stylised drapery highlights, red and lapis blue, aged varnish",
  },
  {
    id: "insular",
    name: "Book of Kells",
    era: "c. 800 · Insular",
    palette: ["#c8962d", "#6b2d5c", "#2f6b5e"],
    prompt: "Insular illuminated manuscript in the style of the Book of Kells (c. 800): interlace knotwork borders, Celtic spirals and zoomorphic ornament, flat stylised figures, orpiment yellow, verdigris green, purple and red on vellum",
  },
  {
    id: "ethiopian",
    name: "Ethiopian gospel",
    era: "15th–17th century",
    palette: ["#e0b23c", "#b13a2b", "#2d4f8a"],
    prompt: "Ethiopian Orthodox manuscript painting, Gondarine style: bold black outlines, large almond eyes, flat bright yellow, red and blue fields, patterned robes, plain warm background, devotional and frontal",
  },
  {
    id: "romanesque",
    name: "Romanesque fresco",
    era: "11th–12th century",
    palette: ["#b8643a", "#3e5f7a", "#e6d3a8"],
    prompt: "Romanesque church fresco, Catalan apse painting (12th century): strong dark contours, banded backgrounds of ochre and blue, hieratic scale, stylised folds, earth pigments on lime plaster",
  },
  {
    id: "stained-glass",
    name: "Gothic stained glass",
    era: "13th century · Chartres",
    palette: ["#1f4fa3", "#b3202a", "#d9a520"],
    prompt: "Gothic stained glass window, Chartres Cathedral (13th century): jewel-toned glass, cobalt blue and ruby red, black lead came outlines, grisaille painted faces, medallion composition, light glowing through",
  },
  {
    id: "rublev",
    name: "Russian icon",
    era: "c. 1410 · Rublev",
    palette: ["#c2a35a", "#4f7f8c", "#9a3d2e"],
    prompt: "Russian Orthodox icon in the manner of Andrei Rublev (c. 1410): luminous egg tempera, soft cabbage-roll greens and cornflower blue, gentle contemplative faces, rhythmic flowing lines, gold assist highlights, gilded background",
  },
  {
    id: "renaissance",
    name: "Renaissance fresco",
    era: "c. 1500 · Italy",
    palette: ["#c79a6b", "#3d5a80", "#7d8c5a"],
    prompt: "Italian High Renaissance fresco (c. 1500): balanced composition, linear perspective, classical architecture, soft sfumato modelling, natural light, calm idealised figures, muted fresco colours",
  },
  {
    id: "baroque",
    name: "Baroque chiaroscuro",
    era: "c. 1600 · Caravaggio",
    palette: ["#1a1410", "#a8432a", "#d8b07a"],
    prompt: "Baroque oil painting in the manner of Caravaggio (c. 1600): dramatic chiaroscuro, a single raking light from the side, deep black shadows, realistic weathered faces, rich red and ochre fabric, dark background",
  },
  {
    id: "rembrandt",
    name: "Rembrandt etching",
    era: "c. 1650 · Dutch",
    palette: ["#2b2621", "#8a7a63", "#efe6d2"],
    prompt: "Rembrandt etching and drypoint (c. 1650): fine cross-hatched lines on warm paper, velvety burr shadows, glowing light at the centre, humble everyday figures, monochrome brown-black ink, plate tone",
  },
  {
    id: "dore",
    name: "Doré engraving",
    era: "1866 · Bible illustrations",
    palette: ["#1c1c1c", "#6e6e6e", "#f1ede4"],
    prompt: "19th-century wood engraving in the style of Gustave Doré's Bible illustrations (1866): dense parallel engraved lines, monumental landscapes, theatrical light breaking through clouds, black and white",
  },
  {
    id: "modern",
    name: "Modern minimal",
    era: "20th century",
    palette: ["#e9e2d0", "#8a1e2b", "#2c2a26"],
    prompt: "Modern minimal sacred art: few bold shapes, generous negative space, limited palette of parchment, garnet and ink, quiet abstraction, contemplative mood",
  },
];

export function styleById(id: unknown) {
  return STYLES.find((style) => style.id === id) ?? STYLES[3];
}
