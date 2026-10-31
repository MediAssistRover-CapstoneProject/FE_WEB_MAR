const screenRoutes = {
  Dashboard: '/admin',
  'Map Studio': '/admin/map',
  'Facility Management': '/admin/facility',
  'Public Catalog': '/admin/public-catalog',
  'Live Operations': '/admin/live-operations',
  'Emergency Center': '/admin/emergency-center',
  Missions: '/admin/missions',
  Patrol: '/admin/patrol',
  'Staff Shifts': '/admin/staff-shifts',
  'Robot Status': '/admin/robots',
  Alerts: '/admin/alerts',
  'History & Replay': '/admin/history-replay',
  Analytics: '/admin/analytics',
  'Audit Logs': '/admin/audit-logs',
  'Workflow Management': '/admin/workflow-catalog',
  'Voice & Scripts': '/admin/voice-scripts',
  Charging: '/admin/charging',
  'Users & Roles': '/admin/users-roles',
  'System Settings': '/admin/system-settings',
  'My Account': '/admin/my-account',
};

const slugToScreen = Object.fromEntries(Object.entries(screenRoutes)
  .filter(([, path]) => path.startsWith('/admin/'))
  .map(([screen, path]) => [path.slice('/admin/'.length), screen]));

export function pathForScreen(screen) {
  return screen === 'Workflows' ? '/workflow' : screenRoutes[screen] || '/admin';
}

export function screenForSlug(slug) {
  return slugToScreen[slug] || null;
}

