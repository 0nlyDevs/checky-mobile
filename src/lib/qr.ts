// The QR of a card's seal, drawn on the phone: nothing leaves it to draw the code. No React Native
// import, so it runs under `node --test`.
import QRCode from "qrcode";

/** The modules of the QR as one SVG path (`viewBox="0 0 box box"`, a quiet zone of `margin` modules).
 *  Level L keeps the long sealed URL at the fewest modules, so a small QR stays readable (as on the desk). */
export function qrPath(text: string, margin = 1): { box: number; d: string } {
  const { size, data } = QRCode.create(text, { errorCorrectionLevel: "L" }).modules;
  const parts: string[] = [];
  for (let y = 0; y < size; y++) {
    let x = 0;
    while (x < size) {
      if (!data[y * size + x]) {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < size && data[y * size + x + run]) run++;
      parts.push(`M${x + margin} ${y + margin}h${run}v1h-${run}z`);
      x += run;
    }
  }
  return { box: size + margin * 2, d: parts.join("") };
}

/** `checky.mg/v/145`: the short address of the verification number, on the seal's own host. */
export function shortLink(seal: { url: string; number?: number | null } | null | undefined): string | null {
  if (!seal || seal.number == null) return null;
  const host = /^https?:\/\/([^/?#]+)/i.exec(seal.url)?.[1];
  return host ? `${host}/v/${seal.number}` : null;
}
