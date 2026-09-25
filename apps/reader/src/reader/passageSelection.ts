/** Whether the reader is holding a text selection anywhere on the page. */
export function hasTextSelection(): boolean {
  const selection = window.getSelection();
  return Boolean(selection && !selection.isCollapsed && selection.toString().trim());
}
