import fs from "fs";
import path from "path";

export type DiscountConfig = {
  Premium: number;
  Guest: number;
  [key: string]: number;
};

const defaultConfig: DiscountConfig = { Premium: 20, Guest: 0 };

function resolveConfigPath(): string | null {
  // 1) Env override
  const envPath = process.env.DISCOUNT_CONFIG_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;

  // 2) Candidate paths for both dev (ts-node) and prod (dist)
  const candidates = [
    path.resolve(__dirname, "../config/discount.json"), 
    path.resolve(process.cwd(), "dist/config/discount.json"),
    path.resolve(process.cwd(), "src/config/discount.json"),
    path.resolve(process.cwd(), "config/discount.json"),
    path.resolve(process.cwd(), "discount.json"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function loadDiscountConfig(): DiscountConfig {
  try {
    const p = resolveConfigPath();
    if (!p) return { ...defaultConfig };
    const raw = fs.readFileSync(p, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      ...defaultConfig,
      ...parsed,
    } as DiscountConfig;
  } catch {
    return { ...defaultConfig };
  }
}

export function saveDiscountConfig(cfg: DiscountConfig): void {
  const p = resolveConfigPath();
  const target = p ?? path.resolve(process.cwd(), "src/config/discount.json");
  const dir = path.dirname(target);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(target, JSON.stringify(cfg, null, 2), "utf-8");
}

export function getDiscountPercent(kind: string): number {
  const config = loadDiscountConfig();
  const value = config[kind] ?? 0;
  const n = Number(value);
  if (!isFinite(n) || n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

export function updatePremiumPercent(percent: number): DiscountConfig {
  const p = Math.max(0, Math.min(100, Number(percent)));
  const cfg = loadDiscountConfig();
  cfg.Premium = p;
  saveDiscountConfig(cfg);
  return cfg;
}
