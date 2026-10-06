/** Injects component-owned styles once, keeping visual styles beside the JSX that uses them. */
export function injectStyles(id, css) {
  if (typeof document === 'undefined' || document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}
