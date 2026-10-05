import { useEffect, useRef, useState } from "react";
import { getInventoryNoteSuggestions } from "../utils/inventoryNoteSuggestions";

// Row-local state; the parent keys this input by product so replacement resets it.
export function StockInNoteInput({ id, groups, value, onChange, onKeyDown, inputRef }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const listRef = useRef(null);
  const suggestions = getInventoryNoteSuggestions(groups, value);
  const visible = isOpen && suggestions.length > 0;
  const listId = `${id}-suggestions`;

  function close() {
    setIsOpen(false);
    setActiveIndex(-1);
  }

  function open() {
    setIsOpen(true);
    setActiveIndex(-1);
  }

  function select(note) {
    onChange(note);
    close();
  }

  function handleKeyDown(event) {
    if (event.nativeEvent?.isComposing) return;
    if (event.key === "Escape" || event.key === "Tab") {
      close();
      return;
    }
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && suggestions.length) {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex(event.key === "ArrowDown"
        ? Math.min((visible ? activeIndex : -1) + 1, suggestions.length - 1)
        : Math.max((visible ? activeIndex : -1) - 1, 0));
      return;
    }
    if (event.key === "Enter" && visible && suggestions[activeIndex] !== undefined) {
      event.preventDefault();
      select(suggestions[activeIndex]);
      return;
    }
    // Preserve Stock In's existing Enter -> quantity workflow for free text.
    onKeyDown?.(event);
  }

  useEffect(() => {
    if (!visible) return;
    function handleOutside(event) {
      if (!wrapperRef.current?.contains(event.target)) close();
    }
    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("focusin", handleOutside);
    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("focusin", handleOutside);
    };
  }, [visible]);

  useEffect(() => {
    const list = listRef.current;
    const option = list?.children[activeIndex];
    if (!visible || !option) return;
    if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight;
    }
  }, [visible, activeIndex]);

  return (
    <div ref={wrapperRef} className="relative min-w-0 max-w-full">
      <input
        id={id}
        ref={inputRef}
        className="stock-in-note-input h-11 w-full min-w-0 max-w-full rounded border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        value={value}
        onChange={(event) => { onChange(event.target.value); open(); }}
        onFocus={open}
        onClick={open}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-label="Nhóm bảo hành / ghi chú"
        aria-autocomplete="list"
        aria-expanded={visible}
        aria-controls={visible ? listId : undefined}
        aria-activedescendant={visible && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        placeholder="Ví dụ: BH 12.28, để trống nếu không ghi chú"
      />
      {visible && (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Gợi ý nhóm bảo hành / ghi chú"
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-24 overflow-y-auto overscroll-contain rounded border border-slate-200 bg-white py-1 shadow-lg"
        >
          {suggestions.map((note, index) => (
            <button
              key={note}
              id={`${listId}-${index}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              tabIndex={-1}
              className={`block min-h-11 w-full px-3 py-2 text-left text-sm text-slate-800 [overflow-wrap:anywhere] hover:bg-blue-50 focus:bg-blue-50 ${index === activeIndex ? "bg-blue-50" : ""}`}
              onPointerDown={(event) => {
                // Keep mouse focus; touch retains native list scrolling. No blur-close handler.
                if (event.pointerType === "mouse" && event.button === 0) event.preventDefault();
              }}
              onClick={() => select(note)}
            >
              {note}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
