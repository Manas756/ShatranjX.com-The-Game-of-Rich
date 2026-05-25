export class Loader {
  constructor(container) {
    this.container = container;
    this.el = document.createElement('div');
    this.el.className = 'loader';
    this.el.innerHTML = '<div class="loader-spinner"></div><span class="loader-text">Loading…</span>';
  }

  show(text = 'Loading…') {
    this.el.querySelector('.loader-text').textContent = text;
    this.container.appendChild(this.el);
  }

  hide() {
    this.el.remove();
  }
}
