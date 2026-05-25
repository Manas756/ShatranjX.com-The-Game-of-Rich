/**
 * Lightweight pub/sub — decouples game modules without a framework.
 */
class EventBus {
  constructor() {
    this._handlers = new Map();
  }

  on(event, handler) {
    if (!this._handlers.has(event)) this._handlers.set(event, new Set());
    this._handlers.get(event).add(handler);
    return () => this.off(event, handler);
  }

  once(event, handler) {
    const wrap = (...args) => {
      this.off(event, wrap);
      handler(...args);
    };
    return this.on(event, wrap);
  }

  off(event, handler) {
    this._handlers.get(event)?.delete(handler);
  }

  emit(event, payload) {
    this._handlers.get(event)?.forEach((h) => {
      try {
        h(payload);
      } catch (err) {
        console.error(`EventBus error [${event}]`, err);
      }
    });
  }

  clear() {
    this._handlers.clear();
  }
}

export const eventBus = new EventBus();
export default EventBus;
