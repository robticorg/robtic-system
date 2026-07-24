import { useEffect, useRef, useState } from "react";
import { Avatar } from "./avatar";
import { Icon, type IconName } from "./icon";

export interface UserMenuItem {
    id: string;
    label: string;
    icon: IconName;
}

interface UserMenuProps {
    userName: string;
    avatarUrl: string | null;
    userId: string;
    items: UserMenuItem[];
    activeId: string;
    onSelect: (id: string) => void;
}

/** The viewer's avatar in the top-left; clicking it opens the navigation dropdown. */
export function UserMenu({ userName, avatarUrl, userId, items, activeId, onSelect }: UserMenuProps) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    // Close when clicking anywhere outside the menu.
    useEffect(() => {
        if (!open) return;
        function handlePointerDown(event: PointerEvent) {
            if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
        }
        window.addEventListener("pointerdown", handlePointerDown);
        return () => window.removeEventListener("pointerdown", handlePointerDown);
    }, [open]);

    return (
        <div className="user-menu" ref={rootRef}>
            <button
                type="button"
                className="viewer-chip"
                aria-haspopup="menu"
                aria-expanded={open}
                title={userName}
                onClick={() => setOpen((v) => !v)}
            >
                <Avatar src={avatarUrl} name={userName} seed={userId} size={30} className="viewer-chip__avatar" />
                <Icon name="chevron-down" size={14} className={open ? "user-menu__chevron user-menu__chevron--open" : "user-menu__chevron"} />
            </button>

            {open && (
                <ul className="user-menu__list" role="menu">
                    <li className="user-menu__header">{userName}</li>
                    {items.map((item) => (
                        <li key={item.id} role="none">
                            <button
                                type="button"
                                role="menuitem"
                                className="user-menu__item"
                                aria-current={activeId === item.id}
                                onClick={() => { setOpen(false); onSelect(item.id); }}
                            >
                                <Icon name={item.icon} size={16} />
                                {item.label}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
