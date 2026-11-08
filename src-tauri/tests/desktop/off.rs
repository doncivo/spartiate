//! I4-05 (D-77) : client Open Food Facts (`off.rs`). Serveur HTTP local simulé (aucun appel réel à Open Food Facts) : produit trouvé,
//! inconnu, JSON invalide, 429, 503, délai, connexion refusée, réponse trop grosse, filtre des nutriments, confidentialité de la requête,
//! garde de débit, validation des entrées, journaux sans code-barres ni texte.

use std::collections::BTreeSet;
use std::time::Duration;

use serde_json::json;
use spartiate_lib::off::{
    product_url, search_url, validate_barcode, validate_query, Config, OffClient, OffError,
    RateWindow, NUTRIMENT_KEYS, SEARCH_PER_MINUTE,
};

use crate::support::http_mock::{reply, start_mock, Reply};

const SHORT: Duration = Duration::from_millis(300);
const BARCODE: &str = "3017620422003";
const FIELDS: &str = "code,product_name,brands,quantity,nutriments";

fn client_for(base: &str) -> OffClient {
    OffClient::new(Config::for_tests(base, Duration::from_secs(5), 64 * 1024))
}

fn product_body() -> String {
    json!({
        "code": BARCODE,
        "status": 1,
        "product": {
            "code": BARCODE,
            "product_name": "Pâte à tartiner",
            "brands": "Marque",
            "quantity": "400 g",
            "image_url": "https://exemple.invalide/x.jpg",
            "nutriments": {
                "energy-kcal_100g": 539,
                "energy-kj_100g": 2252,
                "proteins_100g": 6.3,
                "fat_100g": 30.9,
                "saturated-fat_100g": 10.6,
                "carbohydrates_100g": 57.5,
                "sugars_100g": 56.3,
                "fiber_100g": "0",
                "salt_100g": 0.107,
                "sodium_100g": 0.0428,
                "iron_100g": 0.001,
                "energy-kcal": 539,
                "energy-kcal_unit": "kcal",
                "proteins_100g_note": 3
            }
        }
    })
    .to_string()
}

#[tokio::test]
async fn product_found_keeps_only_the_useful_nutriment_keys() {
    let mock = start_mock(|_| reply(200, &product_body()));
    let out = client_for(&mock.base).product(BARCODE).await.unwrap();
    assert!(out.found);
    assert_eq!(out.products.len(), 1);
    let product = &out.products[0];
    assert_eq!(product.code, BARCODE);
    assert_eq!(product.product_name.as_deref(), Some("Pâte à tartiner"));
    assert_eq!(product.brands.as_deref(), Some("Marque"));
    assert_eq!(product.quantity.as_deref(), Some("400 g"));
    let keys: BTreeSet<&str> = product.nutriments.keys().map(String::as_str).collect();
    let expected: BTreeSet<&str> = NUTRIMENT_KEYS.iter().copied().collect();
    assert_eq!(
        keys, expected,
        "exactement les dix clés utiles, rien d'autre"
    );
    assert_eq!(
        product.nutriments["fiber_100g"], 0.0,
        "texte numérique accepté"
    );
    assert_eq!(product.nutriments["energy-kcal_100g"], 539.0);
    // Sérialisation : la seule forme qui remonte à la WebView.
    let value = serde_json::to_value(&out).unwrap();
    assert_eq!(value["found"], json!(true));
    let product_keys: BTreeSet<String> = value["products"][0]
        .as_object()
        .unwrap()
        .keys()
        .cloned()
        .collect();
    let expected_keys: BTreeSet<String> =
        ["brands", "code", "nutriments", "product_name", "quantity"]
            .into_iter()
            .map(String::from)
            .collect();
    assert_eq!(product_keys, expected_keys);
}

#[tokio::test]
async fn unknown_product_is_found_false_for_status_zero_and_404() {
    let mock = start_mock(|_| {
        reply(
            200,
            r#"{"code":"3017620422003","status":0,"status_verbose":"product not found"}"#,
        )
    });
    let out = client_for(&mock.base).product(BARCODE).await.unwrap();
    assert!(!out.found);
    assert!(out.products.is_empty());
    let mock = start_mock(|_| reply(404, r#"{"status":0,"status_verbose":"product not found"}"#));
    let out = client_for(&mock.base).product(BARCODE).await.unwrap();
    assert!(!out.found && out.products.is_empty());
}

#[tokio::test]
async fn invalid_json_is_bad_response() {
    let mock = start_mock(|_| reply(200, "<html>pas du json"));
    let error = client_for(&mock.base).product(BARCODE).await.unwrap_err();
    assert_eq!(error, OffError::BadResponse);
    let mock = start_mock(|_| reply(200, r#"{"unexpected":true}"#));
    assert_eq!(
        client_for(&mock.base).search("pâtes").await.unwrap_err(),
        OffError::BadResponse
    );
}

#[tokio::test]
async fn http_429_is_rate_limited_with_retry_after_and_503_is_http() {
    let mock = start_mock(|_| Reply {
        status: 429,
        headers: vec![("Retry-After".to_owned(), "42".to_owned())],
        body: String::new(),
    });
    let error = client_for(&mock.base).product(BARCODE).await.unwrap_err();
    assert_eq!(
        error,
        OffError::RateLimited {
            retry_after_seconds: Some(42)
        }
    );
    let mock = start_mock(|_| reply(503, "indisponible"));
    let error = client_for(&mock.base).product(BARCODE).await.unwrap_err();
    assert_eq!(error, OffError::Http { status: 503 });
    assert_eq!(mock.requests().len(), 1, "aucune relance");
}

#[tokio::test]
async fn a_mute_server_times_out_and_a_closed_port_is_offline() {
    let mock = start_mock(|_| {
        std::thread::sleep(Duration::from_millis(1500));
        reply(200, &product_body())
    });
    let client = OffClient::new(Config::for_tests(&mock.base, SHORT, 64 * 1024));
    assert_eq!(
        client.product(BARCODE).await.unwrap_err(),
        OffError::Timeout
    );
    // Port fermé : on réserve un port puis on le libère.
    let closed = {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        format!("http://127.0.0.1:{}", listener.local_addr().unwrap().port())
    };
    assert_eq!(
        client_for(&closed).product(BARCODE).await.unwrap_err(),
        OffError::Offline
    );
}

#[tokio::test]
async fn an_oversized_response_is_refused() {
    let big = format!(
        r#"{{"status":1,"product":{{"code":"{BARCODE}","product_name":"{}"}}}}"#,
        "a".repeat(5000)
    );
    let mock = start_mock(move |_| reply(200, &big));
    let client = OffClient::new(Config::for_tests(&mock.base, Duration::from_secs(5), 1024));
    assert_eq!(
        client.product(BARCODE).await.unwrap_err(),
        OffError::BadResponse
    );
}

#[tokio::test]
async fn search_returns_at_most_twenty_filtered_products() {
    let products: Vec<_> = (0..30)
        .map(|i| {
            json!({
                "code": format!("30176204220{i:02}"),
                "product_name": format!("Produit {i}"),
                "brands": "M",
                "quantity": "1 kg",
                "nutriments": {"proteins_100g": 10, "zinc_100g": 1},
                "ingredients_text": "secret"
            })
        })
        .collect();
    let body = json!({"count": 30, "products": products}).to_string();
    let mock = start_mock(move |_| reply(200, &body));
    let out = client_for(&mock.base)
        .search("pâtes complètes")
        .await
        .unwrap();
    assert!(out.found);
    assert_eq!(out.products.len(), 20);
    assert_eq!(out.products[0].nutriments.len(), 1);
    let empty = start_mock(|_| reply(200, r#"{"count":0,"products":[]}"#));
    let out = client_for(&empty.base).search("zzzz").await.unwrap();
    assert!(!out.found && out.products.is_empty());
}

/// Confidentialité : la requête ne porte que l'URL de base, le code ou la requête, `fields` et le User-Agent.
#[tokio::test]
async fn the_request_carries_nothing_but_the_url_the_fields_and_the_user_agent() {
    let mock = start_mock(|request| {
        if request.target.starts_with("/cgi/") {
            reply(200, r#"{"count":0,"products":[]}"#)
        } else {
            reply(200, &product_body())
        }
    });
    let client = client_for(&mock.base);
    client.product(BARCODE).await.unwrap();
    client.search("pâtes & riz").await.unwrap();
    let requests = mock.requests();
    assert_eq!(requests.len(), 2);
    for request in &requests {
        assert_eq!(request.method, "GET");
        let names: BTreeSet<&str> = request.headers.keys().map(String::as_str).collect();
        let allowed: BTreeSet<&str> = ["host", "user-agent", "accept"].into_iter().collect();
        assert!(names.is_subset(&allowed), "en-têtes inattendus : {names:?}");
        assert_eq!(
            request.headers["user-agent"],
            format!("Spartiate/{} (usage personnel)", env!("CARGO_PKG_VERSION"))
        );
        assert!(!request.headers["user-agent"].contains('@'));
        assert!(request.body.is_empty());
    }
    let pairs_of = |target: &str| -> (String, Vec<(String, String)>) {
        let url = url::Url::parse(&format!("http://x{target}")).unwrap();
        let pairs = url
            .query_pairs()
            .map(|(k, v)| (k.into_owned(), v.into_owned()))
            .collect();
        (url.path().to_owned(), pairs)
    };
    let (path, pairs) = pairs_of(&requests[0].target);
    assert_eq!(path, format!("/api/v2/product/{BARCODE}.json"));
    assert_eq!(pairs, vec![("fields".to_owned(), FIELDS.to_owned())]);
    let (path, pairs) = pairs_of(&requests[1].target);
    assert_eq!(path, "/cgi/search.pl");
    let keys: BTreeSet<&str> = pairs.iter().map(|(k, _)| k.as_str()).collect();
    assert_eq!(
        keys,
        [
            "action",
            "fields",
            "json",
            "page_size",
            "search_simple",
            "search_terms"
        ]
        .into_iter()
        .collect()
    );
    assert!(
        pairs.contains(&("search_terms".into(), "pâtes & riz".into())),
        "{pairs:?}"
    );
    assert!(pairs.contains(&("page_size".into(), "20".into())));
    assert!(pairs.contains(&("fields".into(), FIELDS.into())));
}

#[test]
fn urls_are_built_by_the_url_api_and_stay_https_in_production() {
    let production = Config::production();
    let url = product_url(production.base(), BARCODE);
    assert_eq!(url.scheme(), "https");
    assert_eq!(url.host_str(), Some("world.openfoodfacts.org"));
    assert_eq!(url.path(), format!("/api/v2/product/{BARCODE}.json"));
    // Un texte hostile reste une seule valeur de `search_terms` : ni second `fields`, ni fragment.
    let url = search_url(production.base(), "a b&fields=x#y");
    assert_eq!(url.path(), "/cgi/search.pl");
    assert_eq!(url.fragment(), None);
    assert_eq!(url.query_pairs().filter(|(k, _)| k == "fields").count(), 1);
    let terms: Vec<_> = url
        .query_pairs()
        .filter(|(k, _)| k == "search_terms")
        .map(|(_, v)| v.into_owned())
        .collect();
    assert_eq!(terms, vec!["a b&fields=x#y".to_owned()]);
}

#[test]
fn rate_window_admits_ten_searches_per_minute_with_an_injected_clock() {
    assert_eq!(SEARCH_PER_MINUTE, 10);
    let mut window = RateWindow::new(10, 60_000);
    for i in 0..10 {
        assert_eq!(window.admit(1_000 + i), Ok(()));
    }
    // 11e : refusée, avec le délai avant que la plus ancienne sorte de la fenêtre (arrondi par excès).
    assert_eq!(window.admit(30_000), Err(31));
    assert_eq!(window.admit(60_999), Err(1));
    // La plus ancienne (t = 1 000) est sortie à 61 000 : une place se libère.
    assert_eq!(window.admit(61_000), Ok(()));
    assert_eq!(window.admit(61_000), Err(1));
}

#[tokio::test]
async fn the_eleventh_search_is_refused_without_any_network_call() {
    let mock = start_mock(|_| reply(200, r#"{"count":0,"products":[]}"#));
    let client = client_for(&mock.base);
    for _ in 0..10 {
        client.search("pâtes").await.unwrap();
    }
    let error = client.search("pâtes").await.unwrap_err();
    assert!(
        matches!(error, OffError::RateLimited { retry_after_seconds: Some(s) } if (1..=60).contains(&s)),
        "{error:?}"
    );
    assert_eq!(mock.requests().len(), 10, "aucun appel réseau pour la 11e");
    // Les produits ont leur propre garde, plus large.
    let mock2 = start_mock(|_| reply(200, r#"{"status":0}"#));
    let client2 = client_for(&mock2.base);
    for _ in 0..20 {
        client2.product(BARCODE).await.unwrap();
    }
}

#[tokio::test]
async fn inputs_are_validated_before_any_network_call() {
    let mock = start_mock(|_| reply(200, &product_body()));
    let client = client_for(&mock.base);
    for bad in [
        "",
        "1234567",
        "123456789012345",
        "30176204220a3",
        "3017620 22003",
        "../etc/passwd",
        "３０１７６２０４２２００３",
    ] {
        assert_eq!(
            client.product(bad).await.unwrap_err(),
            OffError::InvalidInput,
            "{bad:?}"
        );
        assert!(!validate_barcode(bad));
    }
    assert!(validate_barcode("12345678") && validate_barcode("12345678901234"));
    let too_long = "x".repeat(101);
    for bad in ["", "a", " a ", &too_long, "ligne\nsuivante", "tab\tulation"] {
        assert_eq!(
            client.search(bad).await.unwrap_err(),
            OffError::InvalidInput,
            "{bad:?}"
        );
    }
    assert!(validate_query("ab") && validate_query(&"é".repeat(100)));
    assert!(mock.requests().is_empty());
}

#[test]
fn errors_serialize_to_the_stable_wire_form() {
    let wire = |e: OffError| serde_json::to_value(e).unwrap();
    assert_eq!(wire(OffError::Offline), json!({"kind": "offline"}));
    assert_eq!(wire(OffError::Timeout), json!({"kind": "timeout"}));
    assert_eq!(wire(OffError::BadResponse), json!({"kind": "bad-response"}));
    assert_eq!(
        wire(OffError::InvalidInput),
        json!({"kind": "invalid-input"})
    );
    assert_eq!(
        wire(OffError::Http { status: 503 }),
        json!({"kind": "http", "status": 503})
    );
    assert_eq!(
        wire(OffError::RateLimited {
            retry_after_seconds: Some(7)
        }),
        json!({"kind": "rate-limited", "retryAfterSeconds": 7})
    );
    assert_eq!(
        wire(OffError::RateLimited {
            retry_after_seconds: None
        }),
        json!({"kind": "rate-limited"})
    );
}

#[tokio::test]
async fn technical_logs_hold_event_names_and_status_but_never_the_barcode_or_the_text() {
    let _log_dir = crate::support::applog_dir_lock();
    let dir = tempfile::tempdir().unwrap();
    let logs = dir.path().join("logs");
    spartiate_lib::applog::init(logs.clone());
    let secret_text = "tartinade-secrete-xyz";
    let mock503 = start_mock(|_| reply(503, "x"));
    let client = client_for(&mock503.base);
    let _ = client.product(BARCODE).await;
    let _ = client.search(secret_text).await;
    let mock_bad = start_mock(|_| reply(200, "pas du json"));
    let _ = client_for(&mock_bad.base).product(BARCODE).await;
    let entries = spartiate_lib::applog::read_entries(&logs, 500).unwrap();
    let off: Vec<_> = entries.iter().filter(|e| e.scope == "off").collect();
    assert!(
        off.iter().any(|e| e.code == "http" && e.n == Some(503)),
        "{off:?}"
    );
    assert!(off.iter().any(|e| e.code == "bad-response"), "{off:?}");
    let mut raw = String::new();
    for file in std::fs::read_dir(&logs).unwrap() {
        raw.push_str(&std::fs::read_to_string(file.unwrap().path()).unwrap());
    }
    assert!(!raw.contains(BARCODE) && !raw.contains(secret_text) && !raw.contains("30176204"));
    assert!(off.iter().all(|e| e.detail.is_empty()));
}

fn port_of(base: &str) -> u16 {
    base.rsplit(':').next().unwrap().parse().unwrap()
}

#[tokio::test]
async fn a_redirect_to_another_host_is_not_followed() {
    let mock = start_mock(|request| {
        let port = request.headers["host"]
            .rsplit(':')
            .next()
            .unwrap()
            .to_owned();
        crate::support::http_mock::redirect(&format!("http://localhost:{port}/ailleurs"))
    });
    let error = client_for(&mock.base).product(BARCODE).await.unwrap_err();
    assert_eq!(error, OffError::Http { status: 302 });
    assert_eq!(mock.requests().len(), 1);
}

#[tokio::test]
async fn a_redirect_to_another_port_of_the_same_host_is_not_followed() {
    let other = start_mock(|_| reply(200, &product_body()));
    let target = format!("{}/x", other.base);
    let mock = start_mock(move |_| crate::support::http_mock::redirect(&target));
    assert_ne!(port_of(&mock.base), port_of(&other.base));
    let error = client_for(&mock.base).product(BARCODE).await.unwrap_err();
    assert_eq!(error, OffError::Http { status: 302 });
    assert_eq!(mock.requests().len(), 1);
    assert!(other.requests().is_empty());
}

#[tokio::test]
async fn more_than_two_same_host_redirects_are_refused() {
    let mock = start_mock(|_| crate::support::http_mock::redirect("/encore"));
    let error = client_for(&mock.base).product(BARCODE).await.unwrap_err();
    assert_eq!(error, OffError::Http { status: 302 });
    assert_eq!(mock.requests().len(), 3, "requête initiale et deux sauts");
}

#[tokio::test]
async fn a_client_refusing_the_scheme_reports_tls_and_the_wire_form_is_stable() {
    let mock = start_mock(|_| reply(200, &product_body()));
    let config = Config::for_tests(&mock.base, Duration::from_secs(5), 64 * 1024).with_https_only();
    let error = OffClient::new(config).product(BARCODE).await.unwrap_err();
    assert_eq!(error, OffError::Tls);
    assert!(mock.requests().is_empty());
    assert_eq!(
        serde_json::to_value(OffError::Tls).unwrap(),
        json!({"kind": "tls"})
    );
}
