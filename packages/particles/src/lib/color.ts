export type ParticleColor = readonly [
  red: number,
  green: number,
  blue: number,
  alpha: number,
];

const namedColorHex = new Map<string, string>();
for (const entry of (
  "aliceblue:f0f8ff,antiquewhite:faebd7,aqua:00ffff,aquamarine:7fffd4," +
  "azure:f0ffff,beige:f5f5dc,bisque:ffe4c4,black:000000," +
  "blanchedalmond:ffebcd,blue:0000ff,blueviolet:8a2be2,brown:a52a2a," +
  "burlywood:deb887,cadetblue:5f9ea0,chartreuse:7fff00,chocolate:d2691e," +
  "coral:ff7f50,cornflowerblue:6495ed,cornsilk:fff8dc,crimson:dc143c," +
  "cyan:00ffff,darkblue:00008b,darkcyan:008b8b,darkgoldenrod:b8860b," +
  "darkgray:a9a9a9,darkgreen:006400,darkgrey:a9a9a9,darkkhaki:bdb76b," +
  "darkmagenta:8b008b,darkolivegreen:556b2f,darkorange:ff8c00," +
  "darkorchid:9932cc,darkred:8b0000,darksalmon:e9967a," +
  "darkseagreen:8fbc8f,darkslateblue:483d8b,darkslategray:2f4f4f," +
  "darkslategrey:2f4f4f,darkturquoise:00ced1,darkviolet:9400d3," +
  "deeppink:ff1493,deepskyblue:00bfff,dimgray:696969,dimgrey:696969," +
  "dodgerblue:1e90ff,firebrick:b22222,floralwhite:fffaf0," +
  "forestgreen:228b22,fuchsia:ff00ff,gainsboro:dcdcdc,ghostwhite:f8f8ff," +
  "gold:ffd700,goldenrod:daa520,gray:808080,green:008000," +
  "greenyellow:adff2f,grey:808080,honeydew:f0fff0,hotpink:ff69b4," +
  "indianred:cd5c5c,indigo:4b0082,ivory:fffff0,khaki:f0e68c," +
  "lavender:e6e6fa,lavenderblush:fff0f5,lawngreen:7cfc00," +
  "lemonchiffon:fffacd,lightblue:add8e6,lightcoral:f08080," +
  "lightcyan:e0ffff,lightgoldenrodyellow:fafad2,lightgray:d3d3d3," +
  "lightgreen:90ee90,lightgrey:d3d3d3,lightpink:ffb6c1," +
  "lightsalmon:ffa07a,lightseagreen:20b2aa,lightskyblue:87cefa," +
  "lightslategray:778899,lightslategrey:778899,lightsteelblue:b0c4de," +
  "lightyellow:ffffe0,lime:00ff00,limegreen:32cd32,linen:faf0e6," +
  "magenta:ff00ff,maroon:800000,mediumaquamarine:66cdaa," +
  "mediumblue:0000cd,mediumorchid:ba55d3,mediumpurple:9370db," +
  "mediumseagreen:3cb371,mediumslateblue:7b68ee," +
  "mediumspringgreen:00fa9a,mediumturquoise:48d1cc," +
  "mediumvioletred:c71585,midnightblue:191970,mintcream:f5fffa," +
  "mistyrose:ffe4e1,moccasin:ffe4b5,navajowhite:ffdead,navy:000080," +
  "oldlace:fdf5e6,olive:808000,olivedrab:6b8e23,orange:ffa500," +
  "orangered:ff4500,orchid:da70d6,palegoldenrod:eee8aa," +
  "palegreen:98fb98,paleturquoise:afeeee,palevioletred:db7093," +
  "papayawhip:ffefd5,peachpuff:ffdab9,peru:cd853f,pink:ffc0cb," +
  "plum:dda0dd,powderblue:b0e0e6,purple:800080," +
  "rebeccapurple:663399,red:ff0000,rosybrown:bc8f8f," +
  "royalblue:4169e1,saddlebrown:8b4513,salmon:fa8072," +
  "sandybrown:f4a460,seagreen:2e8b57,seashell:fff5ee,sienna:a0522d," +
  "silver:c0c0c0,skyblue:87ceeb,slateblue:6a5acd,slategray:708090," +
  "slategrey:708090,snow:fffafa,springgreen:00ff7f," +
  "steelblue:4682b4,tan:d2b48c,teal:008080,thistle:d8bfd8," +
  "tomato:ff6347,turquoise:40e0d0,violet:ee82ee,wheat:f5deb3," +
  "white:ffffff,whitesmoke:f5f5f5,yellow:ffff00,yellowgreen:9acd32"
).split(",")) {
  const separator = entry.indexOf(":");
  namedColorHex.set(entry.slice(0, separator), entry.slice(separator + 1));
}

const colorCache = new Map<string, ParticleColor>();

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function parseNumericToken(token: string): number | undefined {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(token)) {
    return undefined;
  }
  const value = Number(token);
  return Number.isFinite(value) ? value : undefined;
}

function parseAlpha(token: string): number | undefined {
  const percentage = token.endsWith("%");
  const value = parseNumericToken(percentage ? token.slice(0, -1) : token);
  return value === undefined
    ? undefined
    : clampUnit(percentage ? value / 100 : value);
}

function parseRGBChannel(token: string): number | undefined {
  const percentage = token.endsWith("%");
  const value = parseNumericToken(percentage ? token.slice(0, -1) : token);
  return value === undefined
    ? undefined
    : clampUnit(percentage ? value / 100 : value / 255);
}

function parseHue(token: string): number | undefined {
  let numeric: number | undefined;
  let scale = 1;
  if (token.endsWith("deg")) numeric = parseNumericToken(token.slice(0, -3));
  else if (token.endsWith("grad")) {
    numeric = parseNumericToken(token.slice(0, -4));
    scale = 0.9;
  } else if (token.endsWith("rad")) {
    numeric = parseNumericToken(token.slice(0, -3));
    scale = 180 / Math.PI;
  } else if (token.endsWith("turn")) {
    numeric = parseNumericToken(token.slice(0, -4));
    scale = 360;
  } else numeric = parseNumericToken(token);
  if (numeric === undefined) return undefined;
  const degrees = numeric * scale;
  return (((degrees % 360) + 360) % 360) / 360;
}

function parsePercentage(token: string): number | undefined {
  if (!token.endsWith("%")) return undefined;
  const value = parseNumericToken(token.slice(0, -1));
  return value === undefined ? undefined : clampUnit(value / 100);
}

function hueToRGB(p: number, q: number, hue: number): number {
  if (hue < 0) hue += 1;
  if (hue > 1) hue -= 1;
  if (hue < 1 / 6) return p + (q - p) * 6 * hue;
  if (hue < 1 / 2) return q;
  if (hue < 2 / 3) return p + (q - p) * (2 / 3 - hue) * 6;
  return p;
}

function parseHex(source: string): ParticleColor | undefined {
  const match = /^#([\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.exec(
    source,
  );
  if (match === null) return undefined;
  const value = match[1]!;
  const expanded =
    value.length <= 4
      ? [...value].map((character) => character + character).join("")
      : value;
  const withAlpha = expanded.length === 6 ? `${expanded}ff` : expanded;
  return Object.freeze([
    Number.parseInt(withAlpha.slice(0, 2), 16) / 255,
    Number.parseInt(withAlpha.slice(2, 4), 16) / 255,
    Number.parseInt(withAlpha.slice(4, 6), 16) / 255,
    Number.parseInt(withAlpha.slice(6, 8), 16) / 255,
  ]);
}

interface FunctionalColorBody {
  readonly syntax: "legacy" | "modern";
  readonly channels: readonly [string, string, string];
  readonly alpha: string | undefined;
}

function splitFunctionalBody(body: string): FunctionalColorBody | undefined {
  if (body.includes(",")) {
    if (body.includes("/")) return undefined;
    const tokens = body.split(",").map((token) => token.trim());
    if (
      (tokens.length !== 3 && tokens.length !== 4) ||
      tokens.some((token) => token.length === 0)
    ) {
      return undefined;
    }
    return {
      syntax: "legacy",
      channels: [tokens[0]!, tokens[1]!, tokens[2]!],
      alpha: tokens[3],
    };
  }

  const slashParts = body.split("/");
  if (slashParts.length > 2) return undefined;
  const channelSource = slashParts[0]!.trim();
  if (channelSource.length === 0) return undefined;
  const channels = channelSource.split(/\s+/);
  if (channels.length !== 3) return undefined;
  const alpha = slashParts.length === 2 ? slashParts[1]!.trim() : undefined;
  if (alpha !== undefined && alpha.length === 0) return undefined;
  return {
    syntax: "modern",
    channels: [channels[0]!, channels[1]!, channels[2]!],
    alpha,
  };
}

function parseRGB(source: string): ParticleColor | undefined {
  const match = /^rgba?\((.*)\)$/.exec(source);
  if (match === null) return undefined;
  const body = splitFunctionalBody(match[1]!);
  if (body === undefined) return undefined;
  const red = parseRGBChannel(body.channels[0]);
  const green = parseRGBChannel(body.channels[1]);
  const blue = parseRGBChannel(body.channels[2]);
  const alpha = body.alpha === undefined ? 1 : parseAlpha(body.alpha);
  if (
    red === undefined ||
    green === undefined ||
    blue === undefined ||
    alpha === undefined
  ) {
    return undefined;
  }
  return Object.freeze([red, green, blue, alpha]);
}

function parseHSL(source: string): ParticleColor | undefined {
  const match = /^hsla?\((.*)\)$/.exec(source);
  if (match === null) return undefined;
  const body = splitFunctionalBody(match[1]!);
  if (body === undefined) return undefined;
  const hue = parseHue(body.channels[0]);
  const saturation = parsePercentage(body.channels[1]);
  const lightness = parsePercentage(body.channels[2]);
  const alpha = body.alpha === undefined ? 1 : parseAlpha(body.alpha);
  if (
    hue === undefined ||
    saturation === undefined ||
    lightness === undefined ||
    alpha === undefined
  ) {
    return undefined;
  }
  if (saturation === 0) {
    return Object.freeze([lightness, lightness, lightness, alpha]);
  }
  const q =
    lightness < 0.5
      ? lightness * (1 + saturation)
      : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  return Object.freeze([
    hueToRGB(p, q, hue + 1 / 3),
    hueToRGB(p, q, hue),
    hueToRGB(p, q, hue - 1 / 3),
    alpha,
  ]);
}

export function parseParticleColor(source: string): ParticleColor {
  const canonical = source.trim().toLowerCase();
  const cached = colorCache.get(canonical);
  if (cached !== undefined) return cached;

  let color: ParticleColor | undefined;
  if (canonical === "transparent") color = Object.freeze([0, 0, 0, 0]);
  else {
    const named = namedColorHex.get(canonical);
    color =
      parseHex(named === undefined ? canonical : `#${named}`) ??
      parseRGB(canonical) ??
      parseHSL(canonical);
  }
  if (color === undefined) {
    throw new TypeError(
      `Particle color uses unsupported syntax; received "${source}".`,
    );
  }
  colorCache.set(canonical, color);
  return color;
}
