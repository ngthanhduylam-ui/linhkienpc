import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { getEnabledPublicContactLinks, PUBLIC_CONTACT_LINKS } from "../../config/publicContactLinks";
import {
  canStartPublicContactDrag,
  clampPublicContactPosition,
  consumePublicContactClickSuppression,
  didPublicContactPointerMove,
  getDefaultPublicContactPosition,
  getPublicContactExpansionDirection,
  getPublicContactStackSize,
  PUBLIC_CONTACT_STACK_GAP
} from "../../utils/publicFloatingContacts";

const EMPTY_POSITION = Object.freeze({ x: 0, y: 0 });

function viewportSize() {
  return { width: window.innerWidth, height: window.innerHeight };
}

function elementSize(element) {
  const rect = element?.getBoundingClientRect();
  return { width: rect?.width || 0, height: rect?.height || 0 };
}

function MessengerIcon() {
  return (
    <svg aria-hidden="true" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.5 2 2 6.1 2 11.2c0 2.9 1.4 5.4 3.6 7.1V22l3.5-1.9c.9.2 1.9.4 2.9.4 5.5 0 10-4.1 10-9.3S17.5 2 12 2Zm-6 12 5-5.3 3.1 2.4L18 9l-5 5.3-3.1-2.4L6 14Z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M7.2 3.8 9.6 8l-2 1.8c1.2 2.8 3.4 5 6.2 6.2l1.8-2 4.2 2.4-.7 3.2c-.2.8-.9 1.4-1.8 1.4C9.4 21 3 14.6 3 6.7c0-.9.6-1.6 1.4-1.8l2.8-1.1Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ZaloIcon() {
  return (
    <span aria-hidden="true" className="text-[13px] font-bold leading-none tracking-[-0.04em]">
      Zalo
    </span>
  );
}

const CONTACT_ICONS = {
  facebook: MessengerIcon,
  phone: PhoneIcon,
  zalo: ZaloIcon
};

const CONTACT_STYLES = {
  facebook: {
    background: "bg-[#168aff]",
    focusRing: "focus-visible:ring-[#168aff]"
  },
  phone: {
    background: "bg-[#11875d]",
    focusRing: "focus-visible:ring-[#11875d]"
  },
  zalo: {
    background: "bg-[#0068ff]",
    focusRing: "focus-visible:ring-[#0068ff]"
  }
};

export function PublicFloatingContactWidget() {
  const contacts = getEnabledPublicContactLinks(PUBLIC_CONTACT_LINKS);
  const surfaceRef = useRef(null);
  const gestureRef = useRef(null);
  const positionRef = useRef(EMPTY_POSITION);
  const initializedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const suppressClickTimerRef = useRef(null);
  const previousUserSelectRef = useRef("");
  const [position, setPosition] = useState(EMPTY_POSITION);
  const [positionReady, setPositionReady] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hoveredContactId, setHoveredContactId] = useState(null);
  const [focusedContactId, setFocusedContactId] = useState(null);

  const expansionDirection = getPublicContactExpansionDirection(
    position,
    typeof window === "undefined" ? EMPTY_POSITION : viewportSize(),
    elementSize(surfaceRef.current)
  );

  const updatePosition = useCallback((nextPosition) => {
    positionRef.current = nextPosition;
    setPosition(nextPosition);
  }, []);

  const restoreSelection = useCallback(() => {
    document.body.style.userSelect = previousUserSelectRef.current;
    setDragging(false);
  }, []);

  const finishGesture = useCallback((event) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    if (event.currentTarget?.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!gesture.dragging) return;

    restoreSelection();
    suppressClickRef.current = true;
    window.clearTimeout(suppressClickTimerRef.current);
    suppressClickTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = false;
      suppressClickTimerRef.current = null;
    }, 0);
  }, [restoreSelection]);

  function handlePointerDown(event) {
    if (!canStartPublicContactDrag(event)) return;
    gestureRef.current = {
      pointerId: event.pointerId,
      startPointer: { x: event.clientX, y: event.clientY },
      startPosition: positionRef.current,
      dragging: false
    };
  }

  function handlePointerMove(event) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const currentPointer = { x: event.clientX, y: event.clientY };
    if (!gesture.dragging) {
      if (!didPublicContactPointerMove(gesture.startPointer, currentPointer)) return;
      gesture.dragging = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      previousUserSelectRef.current = document.body.style.userSelect;
      document.body.style.userSelect = "none";
      setDragging(true);
    }

    event.preventDefault();
    updatePosition(clampPublicContactPosition({
      x: gesture.startPosition.x + currentPointer.x - gesture.startPointer.x,
      y: gesture.startPosition.y + currentPointer.y - gesture.startPointer.y
    }, viewportSize(), elementSize(surfaceRef.current)));
  }

  function handleClickCapture(event) {
    if (!consumePublicContactClickSuppression(suppressClickRef)) return;
    event.preventDefault();
    event.stopPropagation();
    window.clearTimeout(suppressClickTimerRef.current);
    suppressClickTimerRef.current = null;
  }

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const size = elementSize(surface);
    if (!initializedRef.current) {
      initializedRef.current = true;
      updatePosition(getDefaultPublicContactPosition(
        viewportSize(),
        getPublicContactStackSize(contacts.length)
      ));
      setPositionReady(true);
      return;
    }
    updatePosition(clampPublicContactPosition(positionRef.current, viewportSize(), size));
  }, [updatePosition]);

  useEffect(() => {
    function handleResize() {
      updatePosition(clampPublicContactPosition(
        positionRef.current,
        viewportSize(),
        elementSize(surfaceRef.current)
      ));
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updatePosition]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || typeof ResizeObserver !== "function") return undefined;
    let previousSize = elementSize(surface);
    const observer = new ResizeObserver(() => {
      const nextSize = elementSize(surface);
      if (nextSize.width === previousSize.width && nextSize.height === previousSize.height) return;
      previousSize = nextSize;
      updatePosition(clampPublicContactPosition(positionRef.current, viewportSize(), nextSize));
    });
    observer.observe(surface);
    return () => observer.disconnect();
  }, [updatePosition]);

  useEffect(() => () => {
    gestureRef.current = null;
    window.clearTimeout(suppressClickTimerRef.current);
    document.body.style.userSelect = previousUserSelectRef.current;
  }, []);

  if (!contacts.length) return null;

  return (
    <aside
      ref={surfaceRef}
      aria-label="Liên hệ VI TÍNH PHƯỚC TÀI. Có thể kéo để di chuyển."
      title="Kéo để di chuyển"
      className={`fixed left-0 top-0 z-40 flex w-[50px] max-w-[calc(100vw-1.5rem)] touch-none select-none flex-col ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
      style={{
        gap: `${PUBLIC_CONTACT_STACK_GAP}px`,
        transform: `translate3d(${Math.round(position.x)}px, ${Math.round(position.y)}px, 0)`,
        visibility: positionReady ? "visible" : "hidden"
      }}
      onClickCapture={handleClickCapture}
      onDragStart={(event) => event.preventDefault()}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishGesture}
      onPointerCancel={finishGesture}
      onLostPointerCapture={finishGesture}
    >
      {contacts.map((contact) => {
        const Icon = CONTACT_ICONS[contact.id];
        const isFacebook = contact.id === "facebook";
        const isZalo = contact.id === "zalo";
        const contactStyle = CONTACT_STYLES[contact.id] || CONTACT_STYLES.zalo;
        const label = isFacebook ? "Facebook" : contact.label;
        const isExpanded = !dragging && (
          hoveredContactId === contact.id || focusedContactId === contact.id
        );
        return (
          <a
            key={contact.id}
            href={contact.url}
            target={contact.external ? "_blank" : undefined}
            rel={contact.external ? "noopener noreferrer" : undefined}
            aria-label={isFacebook
              ? "Mở Facebook VI TÍNH PHƯỚC TÀI"
              : isZalo
                ? "Mở Zalo VI TÍNH PHƯỚC TÀI"
                : `Gọi ${contact.label}`}
            className={`relative block h-[50px] w-[50px] cursor-[inherit] rounded-full text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${contactStyle.focusRing}`}
            onMouseEnter={() => setHoveredContactId(contact.id)}
            onMouseLeave={() => setHoveredContactId((current) => (
              current === contact.id ? null : current
            ))}
            onFocus={() => setFocusedContactId(contact.id)}
            onBlur={() => setFocusedContactId((current) => (
              current === contact.id ? null : current
            ))}
          >
            <span
              aria-hidden="true"
              className={`absolute top-0 z-10 flex h-[50px] w-max items-center overflow-hidden rounded-full shadow-[0_2px_6px_rgba(15,23,42,0.22)] ${contactStyle.background} ${expansionDirection === "left" ? "right-0 flex-row-reverse" : "left-0"}`}
            >
              <span className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full">
                {Icon && <Icon />}
              </span>
              <span className={`overflow-hidden transition-[max-width,opacity] duration-200 motion-reduce:transition-none ${isExpanded ? "max-w-48 opacity-100" : "max-w-0 opacity-0"}`}>
                <span className="block whitespace-nowrap px-3">
                  {label}
                </span>
              </span>
            </span>
          </a>
        );
      })}
    </aside>
  );
}
