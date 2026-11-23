import './appDialog.css';

let pending = null;

// One asynchronous dialog at a time. Repeated clicks cannot queue stale actions.
function openDialog(message, initialValue) {
  if (pending) return Promise.resolve(initialValue === undefined ? false : null);
  return new Promise(resolve => {
    const previousFocus = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.className = 'mar-app-dialog';
    const form = document.createElement('form');
    form.method = 'dialog';
    const title = document.createElement('h2');
    title.id = 'mar-app-dialog-title';
    title.textContent = initialValue === undefined ? 'Xác nhận thao tác' : 'Nhập thông tin';
    dialog.setAttribute('aria-labelledby', title.id);
    const description = document.createElement('p');
    description.id = 'mar-app-dialog-description';
    description.textContent = message;
    dialog.setAttribute('aria-describedby', description.id);
    form.append(title, description);
    let input;
    if (initialValue !== undefined) {
      input = document.createElement('input');
      input.value = initialValue;
      input.setAttribute('aria-label', message);
      form.append(input);
    }
    const footer = document.createElement('footer');
    const cancel = document.createElement('button');
    cancel.type = 'button'; cancel.textContent = 'Hủy'; cancel.autofocus = !input;
    const accept = document.createElement('button');
    accept.type = 'submit'; accept.textContent = 'Xác nhận'; accept.className = 'mar-app-dialog-primary';
    footer.append(cancel, accept); form.append(footer); dialog.append(form);
    const finish = accepted => {
      if (pending !== dialog) return;
      pending = null;
      dialog.close(); dialog.remove();
      if (previousFocus?.isConnected) previousFocus.focus();
      resolve(input ? (accepted ? input.value : null) : accepted);
    };
    cancel.onclick = () => finish(false);
    form.onsubmit = event => { event.preventDefault(); finish(true); };
    dialog.oncancel = event => { event.preventDefault(); finish(false); };
    pending = dialog;
    document.body.append(dialog); dialog.showModal();
    if (input) { input.focus(); input.select(); }
  });
}

export const confirmAction = message => openDialog(message);
export const promptValue = (message, initialValue = '') => openDialog(message, initialValue);
