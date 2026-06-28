// Utilidades de cliente: convertir una imagen subida en mapas PBR (albedo + normal).

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("no se pudo cargar la imagen"));
    img.src = src;
  });
}

/**
 * Toma una imagen y genera albedo (reescalado) + un normal map aproximado
 * (Sobel sobre el grayscale como heightmap). Todo en el navegador.
 */
export async function imageToPbr(
  file: File,
  maxSize = 1024,
  strength = 2.2,
): Promise<{ albedo: string; normal: string; name: string }> {
  const dataUrl = await fileToDataUrl(file);
  const img = await loadImage(dataUrl);

  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  const albedo = c.toDataURL("image/jpeg", 0.85);

  const data = ctx.getImageData(0, 0, w, h).data;
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) / 255;
  }
  const at = (x: number, y: number) => gray[clamp(y, 0, h - 1) * w + clamp(x, 0, w - 1)];

  const nc = document.createElement("canvas");
  nc.width = w;
  nc.height = h;
  const nctx = nc.getContext("2d")!;
  const nimg = nctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = at(x - 1, y - 1);
      const t = at(x, y - 1);
      const tr = at(x + 1, y - 1);
      const l = at(x - 1, y);
      const r = at(x + 1, y);
      const bl = at(x - 1, y + 1);
      const b = at(x, y + 1);
      const br = at(x + 1, y + 1);
      const dx = tr + 2 * r + br - (tl + 2 * l + bl);
      const dy = bl + 2 * b + br - (tl + 2 * t + tr);
      let nx = -dx * strength;
      let ny = -dy * strength;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      const nzz = nz / len;
      const idx = (y * w + x) * 4;
      nimg.data[idx] = (nx * 0.5 + 0.5) * 255;
      nimg.data[idx + 1] = (ny * 0.5 + 0.5) * 255;
      nimg.data[idx + 2] = (nzz * 0.5 + 0.5) * 255;
      nimg.data[idx + 3] = 255;
    }
  }
  nctx.putImageData(nimg, 0, 0);
  const normal = nc.toDataURL("image/png");

  const name = file.name.replace(/\.[^.]+$/, "").slice(0, 24) || "Textura";
  return { albedo, normal, name };
}
