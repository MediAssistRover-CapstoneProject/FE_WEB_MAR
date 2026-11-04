export const navigationGroups = [
  ['Overview', ['Dashboard']],
  ['Operations', ['Live Operations', 'Emergency Center', 'Missions', 'Patrol', 'Staff Shifts']],
  ['Map & Navigation', ['Map Studio', 'Facility Management', 'Public Catalog']],
  ['Robot', ['Robot Status']],
  ['Monitoring', ['Alerts', 'History & Replay', 'Analytics', 'Audit Logs']],
  ['Automation', ['Workflows', 'Workflow Management', 'Voice & Scripts', 'AI Test']],
  ['Administration', ['Users & Roles', 'System Settings', 'My Account']],
];

export function isAdminScreen(screen) {
  return navigationGroups.some(([, items]) => items.includes(screen));
}
