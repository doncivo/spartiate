//! SPA-009 critère 2 : taille et position de la fenêtre PC dans la zone de travail du moniteur courant, minimum 1 024 × 700 logiques,
//! jamais abaissé en silence. Fixtures de moniteurs : résolution, mise à l'échelle (DPI), barre des tâches, écran secondaire à gauche.

use spartiate_lib::window_fit::{
    clamp_into_work_areas, fit_window, logical_work_area, Fit, LogicalRect, DEFAULT_HEIGHT,
    DEFAULT_WIDTH, FRAME_HEIGHT, FRAME_WIDTH, MIN_HEIGHT, MIN_WIDTH,
};

fn area(x: f64, y: f64, width: f64, height: f64) -> LogicalRect {
    LogicalRect {
        x,
        y,
        width,
        height,
    }
}

fn close(a: f64, b: f64) -> bool {
    (a - b).abs() < 0.01
}

#[test]
fn constants_match_the_window_configuration() {
    assert_eq!((MIN_WIDTH, MIN_HEIGHT), (1024.0, 700.0));
    assert_eq!((DEFAULT_WIDTH, DEFAULT_HEIGHT), (1440.0, 900.0));
    let config = include_str!("../../tauri.windows.conf.json");
    for fragment in [
        "\"width\": 1440",
        "\"height\": 900",
        "\"minWidth\": 1024",
        "\"minHeight\": 700",
    ] {
        assert!(config.contains(fragment), "{fragment}");
    }
}

#[test]
fn full_hd_with_taskbar_keeps_the_default_size_centered_in_the_work_area() {
    let work = area(0.0, 0.0, 1920.0, 1040.0);
    let Fit::Fits(rect) = fit_window(work, (DEFAULT_WIDTH, DEFAULT_HEIGHT)) else {
        panic!("1920 × 1040 doit contenir la fenêtre");
    };
    assert!(close(rect.width, 1440.0) && close(rect.height, 900.0));
    assert!(close(rect.x, (1920.0 - (1440.0 + FRAME_WIDTH)) / 2.0));
    assert!(close(rect.y, (1040.0 - (900.0 + FRAME_HEIGHT)) / 2.0));
}

#[test]
fn high_dpi_screen_is_converted_to_logical_units_before_fitting() {
    // 2560 × 1440 physiques à 150 % : 1706,67 × 960 logiques ; barre des tâches de 60 px physiques, zone utile 2560 × 1380.
    let work = logical_work_area((0, 0), (2560, 1380), 1.5);
    assert!(close(work.width, 1706.67) && close(work.height, 920.0));
    let Fit::Fits(rect) = fit_window(work, (DEFAULT_WIDTH, DEFAULT_HEIGHT)) else {
        panic!("doit tenir");
    };
    assert!(close(rect.width, 1440.0));
    assert!(
        close(rect.height, 920.0 - FRAME_HEIGHT),
        "la hauteur s'adapte à la zone utile : {}",
        rect.height
    );
    assert!(rect.height >= MIN_HEIGHT);
}

#[test]
fn small_but_sufficient_work_area_shrinks_the_window_down_to_the_minimum() {
    let limit = area(0.0, 0.0, MIN_WIDTH + FRAME_WIDTH, MIN_HEIGHT + FRAME_HEIGHT);
    let Fit::Fits(rect) = fit_window(limit, (DEFAULT_WIDTH, DEFAULT_HEIGHT)) else {
        panic!("la limite exacte tient");
    };
    assert!(close(rect.width, MIN_WIDTH) && close(rect.height, MIN_HEIGHT));
}

#[test]
fn work_area_below_the_minimum_is_reported_never_lowered() {
    // 1366 × 768 avec barre des tâches : zone utile 1366 × 728, soit 689 de hauteur utile < 700.
    let work = area(0.0, 0.0, 1366.0, 728.0);
    match fit_window(work, (DEFAULT_WIDTH, DEFAULT_HEIGHT)) {
        Fit::TooSmall { width, height } => assert!(close(width, 1366.0) && close(height, 728.0)),
        Fit::Fits(rect) => panic!("le minimum ne doit pas être abaissé : {rect:?}"),
    }
    for (w, h) in [
        (MIN_WIDTH + FRAME_WIDTH - 1.0, 1000.0),
        (1920.0, MIN_HEIGHT + FRAME_HEIGHT - 1.0),
    ] {
        assert!(matches!(
            fit_window(area(0.0, 0.0, w, h), (DEFAULT_WIDTH, DEFAULT_HEIGHT)),
            Fit::TooSmall { .. }
        ));
    }
}

#[test]
fn secondary_monitor_on_the_left_keeps_negative_coordinates() {
    let work = area(-1920.0, 0.0, 1920.0, 1040.0);
    let Fit::Fits(rect) = fit_window(work, (DEFAULT_WIDTH, DEFAULT_HEIGHT)) else {
        panic!("doit tenir");
    };
    assert!(rect.x >= -1920.0 && rect.x + rect.width <= 0.0);
}

#[test]
fn restored_position_off_screen_is_brought_back_into_a_work_area() {
    let primary = area(0.0, 0.0, 1920.0, 1040.0);
    let secondary = area(1920.0, 0.0, 1280.0, 1000.0);
    let lost = area(5000.0, 4000.0, 1440.0, 900.0);
    let Fit::Fits(back) = clamp_into_work_areas(lost, &[primary, secondary]) else {
        panic!("doit être ramenée");
    };
    assert!(
        back.x >= 0.0 && back.y >= 0.0 && back.x + back.width <= 1920.0 && back.y + back.height <= 1040.0,
        "{back:?}"
    );
}

#[test]
fn restored_position_with_a_visible_title_bar_is_left_alone() {
    let primary = area(0.0, 0.0, 1920.0, 1040.0);
    let partly = area(-400.0, 10.0, 1440.0, 900.0);
    assert_eq!(
        clamp_into_work_areas(partly, &[primary]),
        Fit::Fits(partly)
    );
}

#[test]
fn restored_position_with_no_work_area_left_is_reported() {
    let lost = area(0.0, 0.0, 1440.0, 900.0);
    assert!(matches!(
        clamp_into_work_areas(lost, &[area(0.0, 0.0, 800.0, 600.0)]),
        Fit::TooSmall { .. }
    ));
    assert!(matches!(clamp_into_work_areas(lost, &[]), Fit::TooSmall { .. }));
}
