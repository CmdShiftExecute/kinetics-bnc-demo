import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/** Compact masthead menu with explicit activation and a complete keyboard path. */
export function IconMenu({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const enterFromEnd = useRef(false);
  useLayoutEffect(() => {
    if (!open) return;
    const entries = Array.from(panel.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []);
    (enterFromEnd.current ? entries.at(-1) : entries[0])?.focus();
  }, [open]);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  const items = () => Array.from(panel.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  return (
    <div className="icon-menu" ref={root} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }} onKeyDown={(event) => {
      if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close(); }
    }}>
      <button ref={trigger} type="button" className="mast-icon" aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} aria-controls={id}
        onClick={() => { enterFromEnd.current = false; setOpen(!open); }} onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            enterFromEnd.current = event.key === 'ArrowUp';
            if (open) (enterFromEnd.current ? items().at(-1) : items()[0])?.focus();
            else setOpen(true);
          }
        }}>{icon}</button>
      <div ref={panel} id={id} className="mast-menu-panel" role="menu" aria-label={label + ' options'} hidden={!open} onClick={(event) => {
        if ((event.target as HTMLElement).closest('[role^="menuitem"]')) close();
      }} onKeyDown={(event) => {
        if (event.key === ' ' && (event.target as HTMLElement).matches('a[role="menuitem"]')) { event.preventDefault(); (event.target as HTMLElement).click(); return; }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const entries = items();
        const index = entries.indexOf(document.activeElement as HTMLElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? entries.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + entries.length) % entries.length;
        entries[next]?.focus();
      }}>
        <p className="mast-menu-heading">{label === 'Module' ? 'Halvard intelligence' : 'Appearance'}</p>
        {children}
      </div>
    </div>
  );
}
