/** Bottom-nav tabs + path helpers for trip-scoped navigation */

export type TripTab = 'home' | 'plan' | 'map' | 'money' | 'trip';
export type PlanSubTab = 'schedule' | 'activities' | 'decisions';

export const TRIP_TABS: TripTab[] = ['home', 'plan', 'map', 'money', 'trip'];
export const PLAN_SUB_TABS: PlanSubTab[] = ['schedule', 'activities', 'decisions'];

export function planSubPath(tripId: string, sub: PlanSubTab = 'decisions'): string {
  return `/trip/${tripId}/plan/${sub}`;
}

export function tripTabPath(
  tripId: string,
  tab: TripTab = 'home',
  planSub: PlanSubTab = 'decisions',
): string {
  switch (tab) {
    case 'home':
      return `/trip/${tripId}/home`;
    case 'plan':
      return planSubPath(tripId, planSub);
    case 'map':
      return `/trip/${tripId}/map`;
    case 'money':
      return `/trip/${tripId}/expenses`;
    case 'trip':
      return `/trip/${tripId}/hub`;
    default:
      return `/trip/${tripId}/home`;
  }
}

/** Resolve which bottom tab is active from the current pathname */
export function tabFromPath(pathname: string): TripTab | null {
  if (!/^\/trip\/[^/]+/.test(pathname)) return null;
  if (/\/plan(\/|$)/.test(pathname) || /\/planner(\/|$)/.test(pathname) || /\/questionnaire(\/|$)/.test(pathname) || /\/decisions(\/|$)/.test(pathname)) {
    return 'plan';
  }
  if (/\/map(\/|$)/.test(pathname)) return 'map';
  if (/\/expenses(\/|$)/.test(pathname)) return 'money';
  if (/\/hub(\/|$)/.test(pathname) || /\/links(\/|$)/.test(pathname) || /\/timeline(\/|$)/.test(pathname)) {
    return 'trip';
  }
  if (/\/home(\/|$)/.test(pathname)) return 'home';
  // bare /trip/:id handled by redirect
  return null;
}

export function planSubFromPath(pathname: string): PlanSubTab | null {
  if (/\/plan\/schedule|\/planner(\/|$)/.test(pathname)) return 'schedule';
  if (/\/plan\/activities|\/questionnaire(\/|$)/.test(pathname)) return 'activities';
  if (/\/plan\/decisions|\/decisions(\/|$)/.test(pathname)) return 'decisions';
  return null;
}
