import { ItemView, WorkspaceLeaf } from "obsidian";
import { render, h } from "preact";
import type FirstMisreadPlugin from "../main";

export const VIEW_TYPE = "first-misread-panel";

export class FirstMisreadView extends ItemView {
  plugin: FirstMisreadPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: FirstMisreadPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE;
  }

  getDisplayText(): string {
    return "First Misread";
  }

  getIcon(): string {
    return "eye";
  }

  async onOpen() {
    const container = this.contentEl;
    container.empty();
    container.addClass("first-misread-panel");

    render(
      h("div", { class: "first-misread-placeholder" },
        h("h3", null, "First Misread"),
        h("p", null, "Open a note and click Analyze to begin.")
      ),
      container
    );
  }

  async onClose() {
    render(null, this.contentEl);
  }
}
