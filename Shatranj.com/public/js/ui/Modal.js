export class Modal {
  constructor(id) {
    this.el = document.getElementById(id);
    if (!this.el) {
      this.el = document.createElement('div');
      this.el.id = id;
      document.body.appendChild(this.el);
    }
    this._ensureStructure();
    this.el.querySelector('.modal-close')?.addEventListener('click', () => this.hide());
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.hide();
    });
  }

  _ensureStructure() {
    if (!this.el.querySelector('.modal-glass')) {
      this.el.className = 'modal-overlay hidden';
      this.el.innerHTML = `
        <div class="modal-glass" role="dialog" aria-modal="true">
          <button type="button" class="modal-close" aria-label="Close">&times;</button>
          <div class="modal-body"></div>
        </div>`;
    }
    this.body = this.el.querySelector('.modal-body');
  }

  setContent(html) {
    this._ensureStructure();
    if (this.body) this.body.innerHTML = html;
  }

  query(selector) {
    return this.el.querySelector(selector);
  }

  show() {
    this.el.classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  hide() {
    this.el.classList.add('hidden');
    document.body.classList.remove('modal-open');
  }

  destroy() {
    this.el.remove();
  }
}

