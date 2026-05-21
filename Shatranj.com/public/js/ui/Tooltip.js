export class Tooltip {
  constructor(el, text) {
    this.el = el;
    this.text = text;
    this.tip = null;
    el.addEventListener('mouseenter', () => this.show());
    el.addEventListener('mouseleave', () => this.hide());
  }

  show() {
    this.tip = document.createElement('div');
    this.tip.className = 'tooltip';
    this.tip.textContent = this.text;
    document.body.appendChild(this.tip);
    const r = this.el.getBoundingClientRect();
    this.tip.style.left = `${r.left + r.width / 2}px`;
    this.tip.style.top = `${r.top - 8}px`;
  }

  hide() {
    this.tip?.remove();
    this.tip = null;
  }
}
