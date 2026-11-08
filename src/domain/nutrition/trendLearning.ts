/**
 * Règle unique d'affichage de la tendance de poids (0.7.1, point 6) : tant qu'il y a moins de 14 pesées, la tendance est « en apprentissage »
 * (maquettes I0 : « 6 / 14 pesées ») sur Aujourd'hui comme sur le Dashboard. Aucune formule : la tendance se calcule dans weightTrend.ts.
 */
export const TREND_WEIGH_INS_NEEDED = 14;

export const isTrendLearning = (weighInCount: number): boolean => weighInCount < TREND_WEIGH_INS_NEEDED;
