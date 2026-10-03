export const navigationGroups = [
  ['Overview', ['Dashboard']],
  ['Operations', ['Live Operations', 'Emergency Center', 'Missions', 'Patrol']],
  ['Map & Navigation', ['Map Studio']],
  ['Robot', ['Robot Status', 'Manual Control', 'Charging']],
  ['Monitoring', ['Alerts', 'Crowd Heatmap', 'History & Replay', 'Analytics']],
  ['Automation', ['Workflows', 'Voice & Scripts']],
  ['Administration', ['Users & Roles', 'System Settings', 'Audit Logs']],
];

export function isAdminScreen(screen) {
  return navigationGroups.some(([, items]) => items.includes(screen));
}
