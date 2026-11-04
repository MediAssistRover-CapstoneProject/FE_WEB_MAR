import { Children, cloneElement, isValidElement } from 'react';
export function Field({ label, children, help, className = '' }) {
  return <label className={'wfd-field ' + className}><span>{label}</span>{Children.map(children, child => isValidElement(child) && ['input', 'select', 'textarea'].includes(child.type) ? cloneElement(child, { 'aria-label': child.props['aria-label'] ?? label }) : child)}{help && <small>{help}</small>}</label>;
}
