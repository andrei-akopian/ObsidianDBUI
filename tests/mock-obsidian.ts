export class App {}
export class TFile {
  basename = "";
  path = "";
  extension = "md";
  parent: any = null;
}
export class TFolder {
  path = "";
  children = [];
}
export class Notice {
  constructor(message: string) {}
}
export function normalizePath(path: string): string {
  return path.replace(/[\\/]+/g, "/").replace(/^\/+|\/+$/g, "");
}
export function stringifyYaml(obj: any): string {
  return JSON.stringify(obj, null, 2);
}
export function parseYaml(yaml: string): any {
  return JSON.parse(yaml);
}
export function addIcon(id: string, svg: string): void {}
export function setIcon(el: HTMLElement, icon: string): void {}
export class Menu {
  addItem() { return this; }
  addSeparator() { return this; }
  showAtMouseEvent() {}
}
export class Modal {
  contentEl = { empty: () => {}, addClass: () => {}, createEl: () => ({ addEventListener: () => {} }), createDiv: () => ({ style: {}, createEl: () => ({ addEventListener: () => {} }) }) };
  open() {}
  close() {}
}
export class MarkdownRenderChild {
  containerEl: HTMLElement;
  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl;
  }
  load() {}
  unload() {}
}
export class TextFileView {
  contentEl = { empty: () => {} };
}
export function debounce<T extends (...args: any[]) => any>(fn: T): T & { cancel: () => void } {
  const f: any = (...args: any[]) => fn(...args);
  f.cancel = () => {};
  return f;
}
export class Plugin {}
export class WorkspaceLeaf {}
