//! Sortie propre (D-01, critère 7) : attente bornée de la confirmation du front.

use std::time::{Duration, Instant};

use spartiate_lib::desktop::{wait_for_confirmation, QuitGate, QUIT_GRACE};

#[test]
fn confirmation_before_the_deadline_lets_the_app_quit_at_once() {
    let gate = QuitGate::default();
    let receiver = gate.begin();
    gate.confirm();
    let started = Instant::now();
    assert!(wait_for_confirmation(&receiver, Duration::from_secs(5)));
    assert!(started.elapsed() < Duration::from_secs(1));
}

#[test]
fn silent_front_does_not_block_the_exit_beyond_the_grace_period() {
    let gate = QuitGate::default();
    let receiver = gate.begin();
    let started = Instant::now();
    assert!(!wait_for_confirmation(
        &receiver,
        Duration::from_millis(100)
    ));
    assert!(started.elapsed() < Duration::from_secs(2));
}

#[test]
fn confirmation_without_pending_exit_is_ignored_and_grace_is_bounded() {
    let gate = QuitGate::default();
    gate.confirm();
    // Y-02 : 5 s au plus pour le dernier cycle de synchro, puis sortie quoi qu'il arrive.
    assert!(QUIT_GRACE <= Duration::from_secs(5));
}

// SHELL-0294d, C-139 : un second « Quitter » pendant l'attente ne remplace pas la porte de sortie (il coupait l'attente du front).
#[test]
fn second_quit_request_does_not_cut_the_first_wait() {
    let gate = QuitGate::default();
    let first = gate.begin_once().expect("la première demande est acceptée");
    assert!(
        gate.begin_once().is_none(),
        "une sortie est déjà en cours : la seconde demande est ignorée"
    );
    gate.confirm();
    assert!(wait_for_confirmation(&first, Duration::from_secs(1)));
}

// SHELL-0294d, C-139 : sans icône de zone de notification, la fermeture de la fenêtre ne la masque pas (elle serait inatteignable).
#[test]
fn closing_without_tray_icon_does_not_hide_the_window() {
    assert!(spartiate_lib::desktop::close_hides_window("main", true));
    assert!(!spartiate_lib::desktop::close_hides_window("main", false));
    assert!(!spartiate_lib::desktop::close_hides_window("other", true));
}
