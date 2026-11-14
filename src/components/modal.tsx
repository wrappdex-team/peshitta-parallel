import { useLayoutEffect, useRef, type ReactNode } from "react";
import { activateModal, isTopModal } from "@/lib/modal-focus";

type Props = {
  label: string;
  /** Points the dialog's name at a heading. When set, aria-label is omitted. */
  labelledBy?: string;
  className: string;
  onClose: () => void;
  children: ReactNode;
  /** Repeat the native dialog role in the DOM for checks that read attributes. */
  announce?: boolean;
};

/** Mounted only while a sheet is open. Rerenders must not reopen it or steal focus. */
export function Modal({ label, labelledBy, className, onClose, children, announce = false }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => {
    if (dialog.current) return activateModal(dialog.current, () => close.current());
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      role={announce ? "dialog" : undefined}
      aria-modal={announce ? true : undefined}
      className={`m-0 h-full max-h-none w-full max-w-none border-0 p-0 text-inherit backdrop:bg-transparent [&:not([open])]:hidden ${className}`}
      onClick={(event) => {
        if (event.target === event.currentTarget && isTopModal(event.currentTarget)) close.current();
      }}
    >
      {children}
    </dialog>
  );
}
