const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><body><div id="root"></div></body>', { url: 'http://localhost/', pretendToBeVisual: true });
for (const k of ['window', 'document', 'HTMLElement', 'Node', 'MouseEvent', 'Event', 'KeyboardEvent', 'localStorage', 'requestAnimationFrame', 'cancelAnimationFrame'])
  Object.defineProperty(globalThis, k, { value: k === 'window' ? dom.window : dom.window[k], configurable: true, writable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = React;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let root = null;
const container = () => document.getElementById('root');
const find = target => typeof target !== 'string' ? target
  : container().querySelector(target.startsWith('text=') ? null : target)
    ?? [...container().querySelectorAll('*')].reverse().find(el => el.textContent.trim() === target.replace(/^text=/, ''));
function need(target) { const el = (() => { try { return find(target); } catch { return [...container().querySelectorAll('*')].reverse().find(e => e.textContent.trim() === target.replace(/^text=/, '')); } })(); if (!el) throw new Error('no element matches ' + target); return el; }
function pretty(html) {
  const tokens = html.match(/<[^>]+>|[^<]+/g) || [];
  const isOpen = t => /^<[a-zA-Z]/.test(t) && !/\/>$/.test(t) && !/^<(input|br|img|hr|meta|link)\b/i.test(t);
  const isClose = t => /^<\//.test(t);
  const out = []; let depth = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i], pad = '  '.repeat(Math.max(depth, 0));
    if (isOpen(t) && isClose(tokens[i + 1] || '')) { out.push(pad + t + tokens[i + 1]); i += 1; }
    else if (isOpen(t) && !/^</.test(tokens[i + 1] || '<') && isClose(tokens[i + 2] || '')) { out.push(pad + t + tokens[i + 1] + tokens[i + 2]); i += 2; }
    else if (isOpen(t)) { out.push(pad + t); depth++; }
    else if (isClose(t)) { depth--; out.push('  '.repeat(Math.max(depth, 0)) + t); }
    else out.push(pad + t);
  }
  return out.join('\n');
}
function readable(node) {
  if (node.nodeType === 3) return node.data;
  return ' ' + [...node.childNodes].map(readable).join('') + ' ';
}
module.exports = {
  React, act,
  render(element) { root ??= createRoot(container()); act(() => root.render(element)); },
  unmount() { act(() => root.unmount()); root = null; },
  html: () => pretty(container().innerHTML),
  text: () => readable(container()).replace(/\s+/g, ' ').trim(),
  click(target) { const el = need(target); act(() => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); }); },
  type(target, value) {
    const el = need(target);
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set;
    act(() => { setter.call(el, value); el.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
  },
  submit(target) { const el = need(target); act(() => { el.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); }); },
  wait: async ms => { for (let left = ms; left > 0; left -= 5) await act(async () => { await sleep(Math.min(5, left)); }); },
  flush: () => act(async () => {}),
};
