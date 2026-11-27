import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { SCHEMA } from "./schema";

let cached: DatabaseSync | null = null;

export function dbPath(): string {
  return process.env.CATALOG_DB ?? path.join(process.cwd(), "data", "catalog.db");
}

export function openDb(file: string = dbPath()): DatabaseSync {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA busy_timeout = 15000; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  // Migrations additives (idempotentes) : niveau de fiabilité de la source.
  for (const sql of [
    "ALTER TABLE specs ADD COLUMN level TEXT NOT NULL DEFAULT 'editorial'",
    "ALTER TABLE support ADD COLUMN level TEXT NOT NULL DEFAULT 'communautaire'",
    "ALTER TABLE models ADD COLUMN release_level TEXT NOT NULL DEFAULT 'communautaire'",
    "ALTER TABLE media ADD COLUMN uploaded_at TEXT",
    // Offres : traçabilité complète (marché, stock, livraison, capacité, contrôle de variante)
    "ALTER TABLE offers ADD COLUMN market TEXT NOT NULL DEFAULT 'FR'",
    "ALTER TABLE offers ADD COLUMN stock TEXT NOT NULL DEFAULT 'inconnu'", // en_stock | rupture | inconnu
    "ALTER TABLE offers ADD COLUMN shipping_status TEXT NOT NULL DEFAULT 'inconnue'", // gratuite_annoncee | payante | inconnue
    "ALTER TABLE offers ADD COLUMN shipping_note TEXT",
    "ALTER TABLE offers ADD COLUMN capacity_status TEXT NOT NULL DEFAULT 'confirmee'", // confirmee | prix_de_depart
    "ALTER TABLE offers ADD COLUMN variant_check TEXT", // ok | ecart | null (non contrôlée)
    "ALTER TABLE offers ADD COLUMN variant_checked_at TEXT",
    "ALTER TABLE offers ADD COLUMN first_seen_at TEXT",
    "ALTER TABLE offers ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE media ADD COLUMN quality TEXT", // detoure | photo
    // Base du prix : devise, et condition éventuelle (reprise, forfait, coupon, nouveau client). null = prix public.
    "ALTER TABLE offers ADD COLUMN currency TEXT NOT NULL DEFAULT 'EUR'",
    "ALTER TABLE offers ADD COLUMN price_conditions TEXT",
  ]) {
    try {
      db.exec(sql);
    } catch {
      /* colonne déjà présente */
    }
  }
  return db;
}

/**
 * Mode lecture seule : sur Vercel, le disque des fonctions est en lecture seule. La base y est construite
 * pendant le déploiement (npm run vercel-build) puis embarquée telle quelle ; le site ne fait que la lire.
 */
export function isReadOnlyRuntime(): boolean {
  return process.env.VERCEL === "1" || process.env.READONLY_DB === "1";
}

export function openReadOnly(file: string = dbPath()): DatabaseSync {
  if (!fs.existsSync(file)) throw new Error(`Base introuvable : ${file}. Lance « npm run import » (ou le build Vercel) pour la créer.`);
  return new DatabaseSync(file, { readOnly: true });
}

/** Connexion partagée côté serveur (lecture). */
export function getDb(): DatabaseSync {
  if (!cached) cached = isReadOnlyRuntime() ? openReadOnly() : openDb();
  return cached;
}

/** Ramène la base à un seul fichier (pas de journal WAL) avant de l'embarquer dans un déploiement. */
export function finalizeForDeploy(db: DatabaseSync) {
  db.exec("PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode = DELETE;");
}
