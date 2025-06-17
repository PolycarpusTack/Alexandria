/**
 * Base Component class for Apicarus UI components
 * @module components/Component
 */

import { ErrorBoundary } from '../utils/errorBoundary.js';

export class Component {
  constructor(plugin) {
    this.plugin = plugin;
    this.state = {};
    this.props = {};
    this.element = null;
    this.children = new Map();
    this._mounted = false;
    this._eventListeners = new Map();
  }

  /**
   * Set component state and trigger re-render
   * @param {Object|Function} newState - New state or state updater function
   */
  setState(newState) {
    const prevState = { ...this.state };
    
    if (typeof newState === 'function') {
      this.state = { ...this.state, ...newState(this.state) };
    } else {
      this.state = { ...this.state, ...newState };
    }
    
    if (this._mounted && this.shouldUpdate(prevState, this.state)) {
      this.update();
    }
  }

  /**
   * Update component props
   * @param {Object} newProps - New props
   */
  setProps(newProps) {
    const prevProps = { ...this.props };
    this.props = { ...this.props, ...newProps };
    
    if (this._mounted && this.shouldUpdate(this.state, this.state, prevProps)) {
      this.update();
    }
  }

  /**
   * Determine if component should re-render
   * @param {Object} prevState - Previous state
   * @param {Object} nextState - Next state
   * @param {Object} prevProps - Previous props
   * @returns {boolean} Should update
   */
  shouldUpdate(prevState, nextState, prevProps = this.props) {
    // Simple shallow comparison
    return !this.shallowEqual(prevState, nextState) || !this.shallowEqual(prevProps, this.props);
  }

  /**
   * Shallow equality check
   * @param {Object} obj1 - First object
   * @param {Object} obj2 - Second object
   * @returns {boolean} Are equal
   */
  shallowEqual(obj1, obj2) {
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    if (keys1.length !== keys2.length) return false;
    
    for (const key of keys1) {
      if (obj1[key] !== obj2[key]) return false;
    }
    
    return true;
  }

  /**
   * Render component HTML
   * @returns {string} HTML string
   */
  render() {
    throw new Error('render() must be implemented by subclass');
  }

  /**
   * Mount component to DOM
   * @param {string|HTMLElement} container - Container element or ID
   */
  mount(container) {
    // Find container element
    if (typeof container === 'string') {
      this.element = document.getElementById(container);
    } else {
      this.element = container;
    }
    
    if (!this.element) {
      throw new Error(`Container not found: ${container}`);
    }
    
    // Render and mount
    this.update();
    this._mounted = true;
    
    // Lifecycle hook
    this.afterMount();
  }

  /**
   * Update component in DOM
   */
  update = ErrorBoundary.wrap(function() {
    if (!this.element) return;
    
    // Store scroll position
    const scrollTop = this.element.scrollTop;
    const scrollLeft = this.element.scrollLeft;
    
    // Clean up old event listeners
    this.cleanupEventListeners();
    
    // Render new HTML
    const html = this.render();
    this.element.innerHTML = html;
    
    // Restore scroll position
    this.element.scrollTop = scrollTop;
    this.element.scrollLeft = scrollLeft;
    
    // Setup new event listeners
    this.setupEventListeners();
    
    // Mount child components
    this.mountChildren();
    
    // Lifecycle hook
    this.afterUpdate();
  }.bind(this), {
    fallback: () => {
      console.error('Failed to update component');
    }
  });

  /**
   * Unmount component from DOM
   */
  unmount() {
    if (!this._mounted) return;
    
    // Lifecycle hook
    this.beforeUnmount();
    
    // Unmount children
    this.unmountChildren();
    
    // Clean up event listeners
    this.cleanupEventListeners();
    
    // Clear element
    if (this.element) {
      this.element.innerHTML = '';
      this.element = null;
    }
    
    this._mounted = false;
  }

  /**
   * Register a child component
   * @param {string} id - Child component ID
   * @param {Component} component - Child component instance
   */
  registerChild(id, component) {
    this.children.set(id, component);
  }

  /**
   * Mount child components
   */
  mountChildren() {
    for (const [id, child] of this.children) {
      const element = this.element.querySelector(`[data-component="${id}"]`);
      if (element) {
        child.mount(element);
      }
    }
  }

  /**
   * Unmount child components
   */
  unmountChildren() {
    for (const child of this.children.values()) {
      child.unmount();
    }
    this.children.clear();
  }

  /**
   * Add event listener with automatic cleanup
   * @param {string} selector - Element selector
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   * @param {Object} options - Event options
   */
  addEventListener(selector, event, handler, options = {}) {
    const elements = this.element.querySelectorAll(selector);
    const wrappedHandler = handler.bind(this);
    
    elements.forEach(element => {
      element.addEventListener(event, wrappedHandler, options);
      
      // Store for cleanup
      if (!this._eventListeners.has(element)) {
        this._eventListeners.set(element, []);
      }
      this._eventListeners.get(element).push({ event, handler: wrappedHandler, options });
    });
  }

  /**
   * Add delegated event listener
   * @param {string} event - Event name
   * @param {string} selector - Element selector
   * @param {Function} handler - Event handler
   */
  delegate(event, selector, handler) {
    const wrappedHandler = (e) => {
      const target = e.target.closest(selector);
      if (target && this.element.contains(target)) {
        handler.call(this, e, target);
      }
    };
    
    this.element.addEventListener(event, wrappedHandler);
    
    // Store for cleanup
    if (!this._eventListeners.has(this.element)) {
      this._eventListeners.set(this.element, []);
    }
    this._eventListeners.get(this.element).push({ event, handler: wrappedHandler });
  }

  /**
   * Clean up event listeners
   */
  cleanupEventListeners() {
    for (const [element, listeners] of this._eventListeners) {
      for (const { event, handler, options } of listeners) {
        element.removeEventListener(event, handler, options);
      }
    }
    this._eventListeners.clear();
  }

  /**
   * Setup event listeners after render
   */
  setupEventListeners() {
    // Override in subclass
  }

  /**
   * Lifecycle: After component mounts
   */
  afterMount() {
    // Override in subclass
  }

  /**
   * Lifecycle: After component updates
   */
  afterUpdate() {
    // Override in subclass
  }

  /**
   * Lifecycle: Before component unmounts
   */
  beforeUnmount() {
    // Override in subclass
  }

  /**
   * Emit custom event
   * @param {string} eventName - Event name
   * @param {*} detail - Event detail
   */
  emit(eventName, detail = null) {
    const event = new CustomEvent(eventName, {
      detail,
      bubbles: true,
      cancelable: true
    });
    
    if (this.element) {
      this.element.dispatchEvent(event);
    }
  }

  /**
   * Query selector within component
   * @param {string} selector - CSS selector
   * @returns {HTMLElement|null} Found element
   */
  $(selector) {
    return this.element?.querySelector(selector);
  }

  /**
   * Query selector all within component
   * @param {string} selector - CSS selector
   * @returns {NodeList} Found elements
   */
  $$(selector) {
    return this.element?.querySelectorAll(selector) || [];
  }

  /**
   * Get or set element attribute
   * @param {HTMLElement} element - Target element
   * @param {string} name - Attribute name
   * @param {string} value - Attribute value (optional)
   * @returns {string|void} Attribute value or void
   */
  attr(element, name, value) {
    if (value === undefined) {
      return element.getAttribute(name);
    }
    element.setAttribute(name, value);
  }

  /**
   * Toggle element class
   * @param {HTMLElement} element - Target element
   * @param {string} className - Class name
   * @param {boolean} force - Force add/remove
   */
  toggleClass(element, className, force) {
    element.classList.toggle(className, force);
  }

  /**
   * Show/hide element
   * @param {HTMLElement} element - Target element
   * @param {boolean} show - Show or hide
   */
  toggle(element, show) {
    element.style.display = show ? '' : 'none';
  }
}