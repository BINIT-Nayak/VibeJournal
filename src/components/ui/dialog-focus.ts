import type { KeyboardEvent } from "react";

// Native dialogs provide inert backgrounds; explicitly wrap Tab so browser chrome
// does not interrupt the confirmation's keyboard sequence.
export function containDialogFocus(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== "Tab") return;
  const dialog = event.currentTarget;
  const controls = Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0);
  const first = controls[0],
    last = controls.at(-1);
  if (!first || !last) {
    event.preventDefault();
    dialog.focus();
  } else if (
    event.shiftKey &&
    (document.activeElement === first || document.activeElement === dialog)
  ) {
    event.preventDefault();
    last.focus();
  } else if (
    !event.shiftKey &&
    (document.activeElement === last || document.activeElement === dialog)
  ) {
    event.preventDefault();
    first.focus();
  }
}
