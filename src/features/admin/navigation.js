export const navigationGroups = [
  ['Overview', ['Dashboard']],
  ['Operations', ['Live Operations', 'Emergency Center', 'Patrol', 'Staff Shifts']],
  ['Map & Navigation', ['Map Studio', 'Facility Management']],
  ['Robot', ['Robot Status', 'Robot Setup']],
  ['Monitoring', ['Alerts', 'History & Replay', 'Analytics', 'Audit Logs']],
  ['Automation', ['Workflows', 'Workflow Dispatch', 'Voice & Scripts', 'AI Test', 'Fall Camera']],
  ['Administration', ['Users & Roles', 'System Settings', 'My Account']],
];

export function isAdminScreen(screen) {
  return navigationGroups.some(([, items]) => items.includes(screen));
}
