//! Client Open Food Facts (I4-05, D-77), PC et iPhone. Deux commandes : `off_product` (code-barres) et `off_search` (texte).
//!
//! - HTTPS seulement (`reqwest` + `rustls`, fournisseur aws-lc-rs) : l'URL de base `http://` n'existe que sous `test` / `test-hooks`.
//! - La requête ne porte que l'URL de base, le code ou la requête, la liste `fields` et le User-Agent `Spartiate/<version> (usage
//!   personnel)` : ni cookie, ni identifiant, ni en-tête personnalisé, ni adresse électronique.
//! - Délai total de 8 s, aucune relance, aucune redirection vers un autre hôte (ni vers `http`), réponse bornée à 1 Mio.
//! - Garde de débit côté Rust : recherche texte 10 par minute, produit 100 par minute (fenêtre glissante) ; au-delà, `rate-limited`
//!   SANS appel réseau.
//! - Seules les dix clés de nutriments utiles remontent à la WebView ; le reste de la réponse est jeté ici.
//! - Journal technique (`applog`) : scope `off`, code d'événement et code HTTP (`n`) seulement ; jamais le code-barres ni le texte cherché.

use std::collections::{BTreeMap, VecDeque};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use serde::Serialize;
use serde_json::Value;
use url::Url;

/// URL de base de l'API publique (production).
pub const BASE_URL: &str = "https://world.openfoodfacts.org/";
/// Liste `fields` demandée à l'API : rien d'autre ne quitte le serveur.
pub const FIELDS: &str = "code,product_name,brands,quantity,nutriments";
/// Clés de `nutriments` conservées (pour 100 g ou 100 ml) ; toutes les autres sont ignorées.
pub const NUTRIMENT_KEYS: [&str; 10] = [
    "energy-kcal_100g",
    "energy-kj_100g",
    "proteins_100g",
    "fat_100g",
    "saturated-fat_100g",
    "carbohydrates_100g",
    "sugars_100g",
    "fiber_100g",
    "salt_100g",
    "sodium_100g",
];
/// Recherches textuelles par minute (fenêtre glissante).
pub const SEARCH_PER_MINUTE: u32 = 10;
/// Requêtes produit par minute (limite publique d'Open Food Facts : 100 par minute).
pub const PRODUCT_PER_MINUTE: u32 = 100;
/// Délai total d'une requête.
pub const TIMEOUT: Duration = Duration::from_secs(8);
/// Taille maximale d'une réponse.
pub const MAX_RESPONSE_BYTES: usize = 1024 * 1024;
const PAGE_SIZE: usize = 20;
const MAX_TEXT_CHARS: usize = 200;
const WINDOW_MS: u64 = 60_000;

/// Réglages du client. Production : `Config::production()`.
#[derive(Debug, Clone)]
pub struct Config {
    base: Url,
    timeout: Duration,
    max_bytes: usize,
    https_only: bool,
    #[cfg(any(test, feature = "test-hooks"))]
    no_proxy: bool,
}

impl Config {
    pub fn production() -> Self {
        Self {
            base: Url::parse(BASE_URL).expect("URL de base valide"),
            timeout: TIMEOUT,
            max_bytes: MAX_RESPONSE_BYTES,
            https_only: true,
            #[cfg(any(test, feature = "test-hooks"))]
            no_proxy: false,
        }
    }

    /// Tests seulement : serveur local en `http://127.0.0.1`, délai et plafond injectables.
    #[cfg(any(test, feature = "test-hooks"))]
    pub fn for_tests(base: &str, timeout: Duration, max_bytes: usize) -> Self {
        Self {
            base: Url::parse(base).expect("URL de test valide"),
            timeout,
            max_bytes,
            https_only: false,
            no_proxy: true,
        }
    }

    pub fn base(&self) -> &Url {
        &self.base
    }
}

/// Un produit, réduit aux champs demandés.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct OffProduct {
    pub code: String,
    pub product_name: Option<String>,
    pub brands: Option<String>,
    pub quantity: Option<String>,
    pub nutriments: BTreeMap<String, f64>,
}

/// Réponse des deux commandes (`products` : 0 ou 1 élément pour `off_product`, 20 au plus pour `off_search`).
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct OffResult {
    pub found: bool,
    pub products: Vec<OffProduct>,
}

/// Erreur sérialisée `{ "kind": "...", "status"?: u16, "retryAfterSeconds"?: u32 }`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum OffError {
    Offline,
    Timeout,
    RateLimited {
        #[serde(rename = "retryAfterSeconds", skip_serializing_if = "Option::is_none")]
        retry_after_seconds: Option<u32>,
    },
    Http {
        status: u16,
    },
    BadResponse,
    InvalidInput,
}

// ------------------------------------------------------------------------------------------------------------------------------
// Validation et URL
// ------------------------------------------------------------------------------------------------------------------------------

/// 8 à 14 chiffres ASCII.
pub fn validate_barcode(code: &str) -> bool {
    (8..=14).contains(&code.len()) && code.bytes().all(|b| b.is_ascii_digit())
}

/// 2 à 100 caractères, sans caractère de contrôle (le texte est évalué après `trim`).
pub fn validate_query(query: &str) -> bool {
    let count = query.chars().count();
    (2..=100).contains(&count) && !query.chars().any(char::is_control)
}

/// `<base>api/v2/product/<code>.json?fields=…` ; le code doit avoir été validé.
pub fn product_url(base: &Url, code: &str) -> Url {
    let mut url = base.clone();
    url.path_segments_mut()
        .expect("URL de base hiérarchique")
        .pop_if_empty()
        .extend(["api", "v2", "product", &format!("{code}.json")]);
    url.query_pairs_mut().append_pair("fields", FIELDS);
    url
}

/// `<base>cgi/search.pl?search_terms=…` ; le texte est encodé par l'API `url`, jamais concaténé.
pub fn search_url(base: &Url, query: &str) -> Url {
    let mut url = base.clone();
    url.path_segments_mut()
        .expect("URL de base hiérarchique")
        .pop_if_empty()
        .extend(["cgi", "search.pl"]);
    url.query_pairs_mut()
        .append_pair("search_terms", query)
        .append_pair("search_simple", "1")
        .append_pair("action", "process")
        .append_pair("json", "1")
        .append_pair("page_size", &PAGE_SIZE.to_string())
        .append_pair("fields", FIELDS);
    url
}

// ------------------------------------------------------------------------------------------------------------------------------
// Garde de débit
// ------------------------------------------------------------------------------------------------------------------------------

/// Fenêtre glissante : au plus `max` admissions sur `window_ms` ; l'horloge (millisecondes) est fournie par l'appelant.
#[derive(Debug, Clone)]
pub struct RateWindow {
    max: usize,
    window_ms: u64,
    stamps: VecDeque<u64>,
}

impl RateWindow {
    pub fn new(max: u32, window_ms: u64) -> Self {
        Self {
            max: max as usize,
            window_ms,
            stamps: VecDeque::new(),
        }
    }

    /// `Ok(())` et l'instant est compté ; sinon `Err(secondes)` avant qu'une place se libère (arrondi par excès, 1 au moins).
    pub fn admit(&mut self, now_ms: u64) -> Result<(), u32> {
        while self
            .stamps
            .front()
            .is_some_and(|oldest| oldest.saturating_add(self.window_ms) <= now_ms)
        {
            self.stamps.pop_front();
        }
        if self.stamps.len() >= self.max {
            let oldest = self.stamps.front().copied().unwrap_or(now_ms);
            let wait_ms = oldest.saturating_add(self.window_ms).saturating_sub(now_ms);
            return Err(u32::try_from(wait_ms.div_ceil(1000).max(1)).unwrap_or(u32::MAX));
        }
        self.stamps.push_back(now_ms);
        Ok(())
    }
}

// ------------------------------------------------------------------------------------------------------------------------------
// Client
// ------------------------------------------------------------------------------------------------------------------------------

pub struct OffClient {
    http: Option<reqwest::Client>,
    config: Config,
    started: Instant,
    search_window: Mutex<RateWindow>,
    product_window: Mutex<RateWindow>,
}

fn install_crypto_provider() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    // Un fournisseur déjà installé par un autre composant (mise à jour PC) convient : l'erreur est donc ignorée.
    ONCE.call_once(|| {
        let _ = rustls::crypto::aws_lc_rs::default_provider().install_default();
    });
}

fn user_agent() -> String {
    format!("Spartiate/{} (usage personnel)", env!("CARGO_PKG_VERSION"))
}

/// Une redirection n'est suivie que vers le même hôte, même schéma, deux sauts au plus ; sinon la réponse 3xx est rendue telle quelle.
fn redirect_policy() -> reqwest::redirect::Policy {
    reqwest::redirect::Policy::custom(|attempt| {
        let same_origin = attempt.previous().last().is_some_and(|last| {
            last.host_str() == attempt.url().host_str() && last.scheme() == attempt.url().scheme()
        });
        if same_origin && attempt.previous().len() < 2 {
            attempt.follow()
        } else {
            attempt.stop()
        }
    })
}

impl OffClient {
    pub fn new(config: Config) -> Self {
        install_crypto_provider();
        let builder = reqwest::Client::builder()
            .user_agent(user_agent())
            .timeout(config.timeout)
            .connect_timeout(config.timeout)
            .https_only(config.https_only)
            .redirect(redirect_policy())
            .referer(false);
        #[cfg(any(test, feature = "test-hooks"))]
        let builder = if config.no_proxy {
            builder.no_proxy()
        } else {
            builder
        };
        Self {
            http: builder.build().ok(),
            config,
            started: Instant::now(),
            search_window: Mutex::new(RateWindow::new(SEARCH_PER_MINUTE, WINDOW_MS)),
            product_window: Mutex::new(RateWindow::new(PRODUCT_PER_MINUTE, WINDOW_MS)),
        }
    }

    fn now_ms(&self) -> u64 {
        u64::try_from(self.started.elapsed().as_millis()).unwrap_or(u64::MAX)
    }

    fn admit(&self, window: &Mutex<RateWindow>) -> Result<(), OffError> {
        let now = self.now_ms();
        let outcome = window
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .admit(now);
        outcome.map_err(|seconds| {
            crate::applog::write("off", "rate-limited-local");
            OffError::RateLimited {
                retry_after_seconds: Some(seconds),
            }
        })
    }

    /// Produit par code-barres (8 à 14 chiffres).
    pub async fn product(&self, barcode: &str) -> Result<OffResult, OffError> {
        if !validate_barcode(barcode) {
            return Err(OffError::InvalidInput);
        }
        self.admit(&self.product_window)?;
        let url = product_url(&self.config.base, barcode);
        let result = self.fetch(url, true).await.and_then(|body| match body {
            None => Ok(OffResult {
                found: false,
                products: vec![],
            }),
            Some(bytes) => parse_product(&bytes, barcode),
        });
        log_failure(&result);
        result
    }

    /// Recherche textuelle (2 à 100 caractères), 20 produits au plus.
    pub async fn search(&self, query: &str) -> Result<OffResult, OffError> {
        let query = query.trim();
        if !validate_query(query) {
            return Err(OffError::InvalidInput);
        }
        self.admit(&self.search_window)?;
        let url = search_url(&self.config.base, query);
        let result = self.fetch(url, false).await.and_then(|body| match body {
            None => Err(OffError::BadResponse),
            Some(bytes) => parse_search(&bytes),
        });
        log_failure(&result);
        result
    }

    /// GET borné. `Ok(None)` : produit inconnu (404, seulement si `not_found_ok`). `Ok(Some(corps))` : réponse 2xx.
    async fn fetch(&self, url: Url, not_found_ok: bool) -> Result<Option<Vec<u8>>, OffError> {
        let http = self.http.as_ref().ok_or(OffError::Offline)?;
        let mut response = http.get(url).send().await.map_err(map_send_error)?;
        let status = response.status();
        if status.as_u16() == 429 {
            let retry = response
                .headers()
                .get(reqwest::header::RETRY_AFTER)
                .and_then(|value| value.to_str().ok())
                .and_then(|text| text.trim().parse::<u32>().ok())
                .map(|seconds| seconds.min(3600));
            return Err(OffError::RateLimited {
                retry_after_seconds: retry,
            });
        }
        if status.as_u16() == 404 && not_found_ok {
            return Ok(None);
        }
        if !status.is_success() {
            return Err(OffError::Http {
                status: status.as_u16(),
            });
        }
        if response
            .content_length()
            .is_some_and(|length| length > self.config.max_bytes as u64)
        {
            return Err(OffError::BadResponse);
        }
        let mut body = Vec::new();
        while let Some(chunk) = response.chunk().await.map_err(|error| {
            if error.is_timeout() {
                OffError::Timeout
            } else {
                OffError::BadResponse
            }
        })? {
            if body.len() + chunk.len() > self.config.max_bytes {
                return Err(OffError::BadResponse);
            }
            body.extend_from_slice(&chunk);
        }
        Ok(Some(body))
    }
}

fn map_send_error(error: reqwest::Error) -> OffError {
    if error.is_timeout() {
        OffError::Timeout
    } else {
        OffError::Offline
    }
}

/// Journal technique : événement et code HTTP, jamais le code-barres ni le texte cherché.
fn log_failure(result: &Result<OffResult, OffError>) {
    match result {
        Ok(_) | Err(OffError::InvalidInput) => {}
        Err(OffError::Offline) => crate::applog::write("off", "offline"),
        Err(OffError::Timeout) => crate::applog::write("off", "timeout"),
        Err(OffError::BadResponse) => crate::applog::write("off", "bad-response"),
        Err(OffError::RateLimited { .. }) => crate::applog::write_count("off", "rate-limited", 429),
        Err(OffError::Http { status }) => {
            crate::applog::write_count("off", "http", u32::from(*status));
        }
    }
}

// ------------------------------------------------------------------------------------------------------------------------------
// Lecture de la réponse
// ------------------------------------------------------------------------------------------------------------------------------

fn text_field(product: &Value, key: &str) -> Option<String> {
    let text: String = product
        .get(key)?
        .as_str()?
        .chars()
        .map(|c| if c.is_control() { ' ' } else { c })
        .collect();
    let text = text.trim();
    (!text.is_empty()).then(|| text.chars().take(MAX_TEXT_CHARS).collect())
}

fn number_of(value: &Value) -> Option<f64> {
    let number = match value {
        Value::Number(n) => n.as_f64()?,
        Value::String(s) => s.trim().replace(',', ".").parse::<f64>().ok()?,
        _ => return None,
    };
    number.is_finite().then_some(number)
}

fn parse_product_object(product: &Value, fallback_code: Option<&str>) -> Option<OffProduct> {
    let object = product.as_object()?;
    let code = match object.get("code").and_then(Value::as_str) {
        Some(code)
            if !code.is_empty()
                && code.len() <= 32
                && code.bytes().all(|b| b.is_ascii_alphanumeric()) =>
        {
            code.to_owned()
        }
        Some(_) => return None,
        None => fallback_code?.to_owned(),
    };
    let mut nutriments = BTreeMap::new();
    if let Some(source) = object.get("nutriments").and_then(Value::as_object) {
        for key in NUTRIMENT_KEYS {
            if let Some(number) = source.get(key).and_then(number_of) {
                nutriments.insert(key.to_owned(), number);
            }
        }
    }
    Some(OffProduct {
        code,
        product_name: text_field(product, "product_name"),
        brands: text_field(product, "brands"),
        quantity: text_field(product, "quantity"),
        nutriments,
    })
}

fn parse_product(bytes: &[u8], barcode: &str) -> Result<OffResult, OffError> {
    let root: Value = serde_json::from_slice(bytes).map_err(|_| OffError::BadResponse)?;
    let root = root.as_object().ok_or(OffError::BadResponse)?;
    let status = root.get("status").and_then(Value::as_i64);
    if status == Some(0) {
        return Ok(OffResult {
            found: false,
            products: vec![],
        });
    }
    let product = root.get("product").ok_or(OffError::BadResponse)?;
    let parsed = parse_product_object(product, Some(barcode)).ok_or(OffError::BadResponse)?;
    Ok(OffResult {
        found: true,
        products: vec![parsed],
    })
}

fn parse_search(bytes: &[u8]) -> Result<OffResult, OffError> {
    let root: Value = serde_json::from_slice(bytes).map_err(|_| OffError::BadResponse)?;
    let list = root
        .get("products")
        .and_then(Value::as_array)
        .ok_or(OffError::BadResponse)?;
    let products: Vec<OffProduct> = list
        .iter()
        .filter_map(|item| parse_product_object(item, None))
        .take(PAGE_SIZE)
        .collect();
    Ok(OffResult {
        found: !products.is_empty(),
        products,
    })
}

// ------------------------------------------------------------------------------------------------------------------------------
// Commandes Tauri (capability `off.json`, fenêtre main, PC et iPhone)
// ------------------------------------------------------------------------------------------------------------------------------

fn shared() -> &'static OffClient {
    static CLIENT: OnceLock<OffClient> = OnceLock::new();
    CLIENT.get_or_init(|| OffClient::new(Config::production()))
}

/// Produit par code-barres (8 à 14 chiffres). `products` : 0 ou 1 élément.
#[tauri::command]
pub async fn off_product(barcode: String) -> Result<OffResult, OffError> {
    shared().product(&barcode).await
}

/// Recherche texte (2 à 100 caractères), 20 produits au plus ; 10 recherches par minute.
#[tauri::command]
pub async fn off_search(query: String) -> Result<OffResult, OffError> {
    shared().search(&query).await
}
