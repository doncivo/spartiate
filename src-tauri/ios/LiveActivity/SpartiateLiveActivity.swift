// SPA-007, I1-02 : extension WidgetKit de la Live Activity (écran verrouillé et Dynamic Island), minuteur de test et repos entre séries.
// Le décompte utilise Text(timerInterval:countsDown:), que le système fait avancer seul : aucune mise à jour, aucun JavaScript, aucun push,
// aucun mode d'arrière-plan, aucun App Group.
//
// Couleurs (I1-02) : fond, texte et accent repris de la charte (§ 18.4, src/ui/theme/tokens.css), identiques en mode clair et sombre du
// téléphone. Chaque présentation force sa couleur de texte (.foregroundStyle) : sans cela le texte suit la couleur système, noire en mode
// clair, illisible sur le fond sombre (constat d'Ali du 2026-11-06, 0.1.6). Contrastes sur le fond #15171C : texte ivoire 14,6:1, texte
// secondaire 6,6:1, bronze 6,2:1 (AA ≥ 4,5:1, recalculés par scripts/ios/liveActivity.test.ts).
//
// État final (« Terminé ») — Option retenue : une vue lisible SANS aucun rafraîchissement, plus trois occasions de redessin.
// 1. Sans redessin : l'heure de fin est affichée en permanence (drapeau + Text(endDate, style: .time)) ; si le système ne redessine pas la
//    vue à l'échéance, le décompte figé à 0:00 se lit avec l'heure de fin déjà passée, au lieu d'un 0:00 seul.
// 2. staleDate = endDate (plugin) : quand le système redessine la vue périmée, context.isStale rend finishedLabel (texte de l'i18n).
// 3. Si l'app tourne encore à l'échéance, le plugin termine l'activité avec son contenu final (redessin garanti par ActivityKit), gardée
//    quelques minutes sur l'écran verrouillé.
// 4. À chaque ouverture de l'app, toute activité échue est fermée sans délai (endExpired).
// Écartés : un `end` anticipé au démarrage (une activité terminée quitte la Dynamic Island : le décompte n'y serait plus) ; relevanceScore
// (ne sert qu'à ordonner plusieurs activités) ; la notification d'échéance ne réveille pas l'app (aucun code ne tourne app suspendue).
// Non prouvable sans l'iPhone : que le système redessine bien la vue périmée app fermée (constat 0.1.6 : non, d'où le point 1).

import ActivityKit
import SwiftUI
import WidgetKit

extension Color {
  /// Couleur « 0xRRGGBB » de la charte (sRGB).
  init(spartiateHex hex: UInt32) {
    self.init(
      red: Double((hex >> 16) & 0xFF) / 255.0,
      green: Double((hex >> 8) & 0xFF) / 255.0,
      blue: Double(hex & 0xFF) / 255.0)
  }
}

/// Couleurs de la charte (§ 18.4), mêmes valeurs dans les deux thèmes de tokens.css ; le token cité est vérifié par un test.
enum SpartiateCharte {
  static let fond = Color(spartiateHex: 0x15171C) // --ct-color-nav-bg (charte --surface, sombre)
  static let texte = Color(spartiateHex: 0xEDE7DC) // --ct-color-accent-on (charte --fg, ivoire)
  static let texteSecondaire = Color(spartiateHex: 0xA39C90) // --ct-color-nav-text (charte --fg-2)
  static let bronze = Color(spartiateHex: 0xC28E4C) // --ct-color-nav-accent (charte --bronze)
}

@main
struct SpartiateLiveActivityBundle: WidgetBundle {
  var body: some Widget {
    SpartiateTimerLiveActivity()
  }
}

/// Décompte jusqu'à la date de fin ; une date déjà passée affiche 0:00 (une plage inversée serait invalide).
struct SpartiateCountdown: View {
  let endDate: Date

  var body: some View {
    if endDate > Date.now {
      Text(timerInterval: Date.now...endDate, countsDown: true)
        .monospacedDigit()
    } else {
      Text("0:00")
        .monospacedDigit()
    }
  }
}

/// Décompte, ou état final (finishedLabel, texte de l'i18n) quand la vue est redessinée après l'échéance ou périmée.
struct SpartiateRemaining: View {
  let state: SpartiateTimerAttributes.ContentState
  let isStale: Bool

  var body: some View {
    if isStale || state.endDate <= Date.now {
      Text(state.finishedLabel)
    } else {
      SpartiateCountdown(endDate: state.endDate)
    }
  }
}

/// Icône : minuteur pendant le décompte, coche à l'état final.
struct SpartiateIcon: View {
  let state: SpartiateTimerAttributes.ContentState
  let isStale: Bool

  var body: some View {
    Image(systemName: isStale || state.endDate <= Date.now ? "checkmark.circle" : "timer")
  }
}

/// Heure de fin, affichée en permanence : lisible même si le système ne redessine jamais la vue après l'échéance.
struct SpartiateEndTime: View {
  let endDate: Date

  var body: some View {
    HStack(spacing: 4) {
      Image(systemName: "flag.checkered")
      Text(endDate, style: .time)
        .monospacedDigit()
    }
  }
}

/// Écran verrouillé et bannière.
struct SpartiateLockScreenView: View {
  let context: ActivityViewContext<SpartiateTimerAttributes>

  var body: some View {
    HStack(spacing: 12) {
      SpartiateIcon(state: context.state, isStale: context.isStale)
        .font(.title2)
        .foregroundStyle(SpartiateCharte.bronze)
      VStack(alignment: .leading, spacing: 2) {
        Text(context.state.label)
          .font(.subheadline)
          .lineLimit(1)
          .foregroundStyle(SpartiateCharte.texte)
        SpartiateRemaining(state: context.state, isStale: context.isStale)
          .font(.largeTitle.weight(.semibold))
          .foregroundStyle(SpartiateCharte.texte)
        SpartiateEndTime(endDate: context.state.endDate)
          .font(.caption)
          .foregroundStyle(SpartiateCharte.texteSecondaire)
      }
      Spacer(minLength: 0)
    }
    .foregroundStyle(SpartiateCharte.texte)
    .padding(16)
    .environment(\.colorScheme, .dark)
    .activityBackgroundTint(SpartiateCharte.fond)
    .activitySystemActionForegroundColor(SpartiateCharte.texte)
  }
}

struct SpartiateTimerLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: SpartiateTimerAttributes.self) { context in
      SpartiateLockScreenView(context: context)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          SpartiateIcon(state: context.state, isStale: context.isStale)
            .font(.title2)
            .foregroundStyle(SpartiateCharte.bronze)
            .environment(\.colorScheme, .dark)
        }
        DynamicIslandExpandedRegion(.trailing) {
          SpartiateRemaining(state: context.state, isStale: context.isStale)
            .font(.title.weight(.semibold))
            .foregroundStyle(SpartiateCharte.texte)
            .environment(\.colorScheme, .dark)
        }
        DynamicIslandExpandedRegion(.bottom) {
          HStack(spacing: 8) {
            Text(context.state.label)
              .font(.subheadline)
              .lineLimit(1)
              .foregroundStyle(SpartiateCharte.texte)
            Spacer(minLength: 0)
            SpartiateEndTime(endDate: context.state.endDate)
              .font(.caption)
              .foregroundStyle(SpartiateCharte.texteSecondaire)
          }
          .environment(\.colorScheme, .dark)
        }
      } compactLeading: {
        SpartiateIcon(state: context.state, isStale: context.isStale)
          .foregroundStyle(SpartiateCharte.bronze)
      } compactTrailing: {
        SpartiateRemaining(state: context.state, isStale: context.isStale)
          .frame(width: 52)
          .foregroundStyle(SpartiateCharte.texte)
      } minimal: {
        SpartiateIcon(state: context.state, isStale: context.isStale)
          .foregroundStyle(SpartiateCharte.bronze)
      }
      .keylineTint(SpartiateCharte.bronze)
    }
  }
}
