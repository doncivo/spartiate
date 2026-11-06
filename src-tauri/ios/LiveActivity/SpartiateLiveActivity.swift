// SPA-007 : extension WidgetKit de la Live Activity (écran verrouillé et Dynamic Island). Le décompte utilise Text(timerInterval:countsDown:),
// que le système fait avancer seul : aucune mise à jour, aucun JavaScript, aucun push, aucun mode d'arrière-plan.

import ActivityKit
import SwiftUI
import WidgetKit

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

struct SpartiateTimerLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: SpartiateTimerAttributes.self) { context in
      // Écran verrouillé et bannière.
      HStack(spacing: 12) {
        Image(systemName: "timer")
          .font(.title2)
        VStack(alignment: .leading, spacing: 2) {
          Text(context.state.label)
            .font(.subheadline)
            .lineLimit(1)
          SpartiateCountdown(endDate: context.state.endDate)
            .font(.largeTitle.weight(.semibold))
        }
        Spacer(minLength: 0)
      }
      .padding(16)
      .activityBackgroundTint(Color.black.opacity(0.85))
      .activitySystemActionForegroundColor(Color.white)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Image(systemName: "timer")
            .font(.title2)
        }
        DynamicIslandExpandedRegion(.trailing) {
          SpartiateCountdown(endDate: context.state.endDate)
            .font(.title.weight(.semibold))
        }
        DynamicIslandExpandedRegion(.bottom) {
          Text(context.state.label)
            .font(.subheadline)
            .lineLimit(1)
        }
      } compactLeading: {
        Image(systemName: "timer")
      } compactTrailing: {
        SpartiateCountdown(endDate: context.state.endDate)
          .frame(width: 52)
      } minimal: {
        Image(systemName: "timer")
      }
    }
  }
}
