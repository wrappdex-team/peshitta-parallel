import { DECLARATION, NAME_HEBREW, longDate } from "@/lib/declaration";

const PAPER = "#f3efe4";
const INK = "#1c1612";
const GOLD = "#8d6b32";
const GARNET = "#7a2e38";
const LINE = "#d9d0c0";

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function seal(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = GARNET;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.865, 0, Math.PI * 2);
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.755, 0, Math.PI * 2);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.fillStyle = PAPER;
  ctx.font = "600 78px 'Noto Serif Hebrew', serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.direction = "rtl";
  ctx.fillText(NAME_HEBREW, cx, cy + 2);
  ctx.direction = "ltr";
}

export async function declarationPng(input: { name: string; date: string }) {
  await document.fonts.load("600 78px 'Noto Serif Hebrew'");
  await document.fonts.load("48px 'Noto Sans Syriac'");
  await document.fonts.load("600 22px Newsreader");
  await document.fonts.load("400 26px Newsreader");
  await document.fonts.load("italic 600 40px Newsreader");

  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1800;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This device could not draw the declaration.");

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  ctx.strokeRect(40, 40, 1120, 1720);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.strokeRect(56, 56, 1088, 1688);

  seal(ctx, 600, 230, 118);

  ctx.fillStyle = GOLD;
  ctx.font = "600 22px Newsreader, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("THE FOUR GOSPELS", 600, 400);

  ctx.fillStyle = INK;
  ctx.font = "48px 'Noto Sans Syriac', serif";
  ctx.direction = "rtl";
  ctx.fillText("ܐܘܢܓܠܝܘܢ", 600, 468);
  ctx.direction = "ltr";

  ctx.font = "600 52px Newsreader, serif";
  ctx.fillText("I have read the words", 600, 548);

  const when = longDate(input.date);
  ctx.fillStyle = GOLD;
  ctx.font = "400 22px Newsreader, serif";
  ctx.fillText(
    when ? `Matthew, Mark, Luke, and John. Read through on ${when}.` : "Matthew, Mark, Luke, and John.",
    600,
    598,
  );

  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(540, 628);
  ctx.lineTo(660, 628);
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.fillStyle = INK;
  ctx.font = "400 26px Newsreader, serif";
  let y = 680;
  for (const paragraph of DECLARATION) {
    const lines = wrap(ctx, paragraph, 900);
    for (const line of lines) {
      ctx.fillText(line, 150, y);
      y += 38;
    }
    y += 16;
  }

  const lineY = Math.max(y + 36, 1520);
  ctx.strokeStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(240, lineY);
  ctx.lineTo(960, lineY);
  ctx.stroke();

  const signed = input.name.trim();
  if (signed) {
    let size = 40;
    ctx.textAlign = "center";
    ctx.fillStyle = INK;
    ctx.font = `italic 600 ${size}px Newsreader, serif`;
    while (size > 18 && ctx.measureText(signed).width > 700) {
      size -= 2;
      ctx.font = `italic 600 ${size}px Newsreader, serif`;
    }
    ctx.fillText(signed, 600, lineY - 18);
  }
  ctx.fillStyle = GOLD;
  ctx.font = "400 18px Newsreader, serif";
  ctx.textAlign = "center";
  ctx.fillText(signed ? "Signed on this device" : "The signature is left open", 600, lineY + 36);
  ctx.fillText("Injeel", 600, 1708);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("This device could not save the declaration.");
  return blob;
}
