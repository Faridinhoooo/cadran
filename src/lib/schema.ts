// Schéma SQLite du catalogue. Le fichier est partagé par le site et par le script d'import.
//
// Hiérarchie : brand → series (gamme) → model (variante matérielle : un 4G et un 5G sont deux fiches)
//              → config (stockage/RAM) → offer (offre marchande datée, pour UNE config).
// Une offre est toujours rattachée à une configuration précise : un prix 128 Go ne peut pas
// être lu pour la version 256 Go.

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT,                    -- ex. redmi → xiaomi (pour la recherche « Xiaomi »)
  origin_country TEXT,               -- pays de fondation de la marque (définition unique)
  origin_note TEXT,
  owner_group TEXT,                  -- constructeur / groupe propriétaire
  headquarters TEXT,                 -- siège actuel (champ distinct)
  source_url TEXT,
  aliases TEXT NOT NULL DEFAULT '[]' -- JSON : écritures courantes (« one plus », « pocco »)
);

CREATE TABLE IF NOT EXISTS series (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id),
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS models (
  id TEXT PRIMARY KEY,               -- slug
  brand_id TEXT NOT NULL REFERENCES brands(id),
  series_id TEXT REFERENCES series(id),
  name TEXT NOT NULL,
  family TEXT,                       -- regroupe 4G/5G d'un même nom commercial
  os TEXT,                           -- 'ios' | 'android' | null
  form_factor TEXT,                  -- 'classique' | 'pliable' | 'clapet' | 'durci'
  release_date TEXT,                 -- ISO, éventuellement 'YYYY-MM'
  release_scope TEXT NOT NULL,       -- 'fr' | 'monde'
  release_source TEXT,
  fr_status TEXT NOT NULL,           -- 'confirme' | 'a_verifier'
  fr_source TEXT,
  discontinued INTEGER NOT NULL DEFAULT 0,
  is_test INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS specs (
  model_id TEXT NOT NULL REFERENCES models(id),
  key TEXT NOT NULL,
  value TEXT NOT NULL,               -- JSON
  kind TEXT NOT NULL,                -- 'annonce' (fabricant) | 'mesure' (test indépendant)
  source_name TEXT NOT NULL,
  source_url TEXT,
  checked_at TEXT,
  PRIMARY KEY (model_id, key, kind)
);

CREATE TABLE IF NOT EXISTS configs (
  id TEXT PRIMARY KEY,               -- model_id + '-' + storage
  model_id TEXT NOT NULL REFERENCES models(id),
  storage_gb INTEGER NOT NULL,
  ram_gb REAL
);

CREATE TABLE IF NOT EXISTS support (
  model_id TEXT PRIMARY KEY REFERENCES models(id),
  os_launch TEXT,
  os_latest_verified TEXT,
  upgrade_commitment TEXT,           -- texte exact de l'engagement
  upgrade_count INTEGER,             -- nb de versions garanties si l'unité est « versions »
  upgrades_delivered INTEGER,        -- versions déjà livrées, si vérifiable
  upgrade_end TEXT,                  -- échéance des mises à niveau (si calculable)
  upgrade_end_precision TEXT,        -- 'jour' | 'mois'
  security_years REAL,
  security_end TEXT,
  security_end_precision TEXT,       -- 'jour' | 'mois'
  security_end_confirmed INTEGER NOT NULL DEFAULT 0, -- 1 = fin de support confirmée
  security_frequency TEXT,
  source_name TEXT,
  source_url TEXT,
  policy_url TEXT,
  checked_at TEXT
);

CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model_id TEXT NOT NULL REFERENCES models(id),
  kind TEXT NOT NULL,                -- 'photo' | '3d'
  view TEXT,                         -- 'face' | 'dos' | 'profil' | 'autre'
  url TEXT NOT NULL,
  thumb_url TEXT,
  color TEXT,
  license TEXT NOT NULL,
  author TEXT,
  source_url TEXT NOT NULL,
  provider TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  UNIQUE(model_id, url)
);

CREATE TABLE IF NOT EXISTS offers (
  id TEXT PRIMARY KEY,               -- source + identifiant externe (évite les doublons)
  config_id TEXT NOT NULL REFERENCES configs(id),
  condition TEXT NOT NULL,           -- 'neuf' | 'reconditionne' | 'occasion'
  seller TEXT NOT NULL,              -- vendeur réel
  platform TEXT,                     -- plateforme éventuelle
  price REAL NOT NULL,
  mandatory_fees REAL,               -- frais obligatoires (null = inconnu)
  shipping REAL,                     -- livraison (null = inconnue)
  color TEXT,
  grade TEXT,
  battery_note TEXT,
  warranty TEXT,
  returns_policy TEXT,
  url TEXT NOT NULL,
  available INTEGER NOT NULL,
  checked_at TEXT NOT NULL,
  source TEXT NOT NULL,
  is_test INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS market_observations (
  id TEXT PRIMARY KEY,               -- source + id annonce (déduplication)
  config_id TEXT NOT NULL REFERENCES configs(id),
  condition_class TEXT NOT NULL,     -- état comparable, ex. 'bon'
  price REAL NOT NULL,
  observed_at TEXT NOT NULL,
  source TEXT NOT NULL,
  excluded_reason TEXT,              -- doublon, pour pièces, bloqué… (exclue du calcul)
  is_test INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS import_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  added INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_models_brand ON models(brand_id);
CREATE INDEX IF NOT EXISTS idx_configs_model ON configs(model_id);
CREATE INDEX IF NOT EXISTS idx_offers_config ON offers(config_id);
`;
