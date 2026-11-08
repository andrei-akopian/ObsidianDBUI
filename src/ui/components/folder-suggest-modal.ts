import { App, FuzzyMatch, FuzzySuggestModal, TFolder } from "obsidian";

export class FolderSuggestModal extends FuzzySuggestModal<TFolder | null> {
  private onSelectFolder: (folderPath: string) => void;

  constructor(app: App, onSelectFolder: (folderPath: string) => void) {
    super(app);
    this.onSelectFolder = onSelectFolder;
    this.setPlaceholder("Select source folder...");
  }

  getItems(): (TFolder | null)[] {
    const folders: (TFolder | null)[] = [null]; // null represents vault root "/"
    const files = this.app.vault.getAllLoadedFiles();
    for (const f of files) {
      if (f instanceof TFolder && f.path) {
        folders.push(f);
      }
    }
    return folders;
  }

  getItemText(item: TFolder | null): string {
    if (!item) return "/ (Vault Root)";
    return item.path;
  }

  onChooseItem(item: TFolder | null, evt: MouseEvent | KeyboardEvent): void {
    const path = item ? item.path : "";
    this.onSelectFolder(path);
  }
}
