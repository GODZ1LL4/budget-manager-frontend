import { useState } from "react";

function CollapseSection({ title, children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border rounded shadow mb-4 bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left px-4 py-3 bg-gray-100 hover:bg-gray-200 font-semibold flex justify-between items-center"
      >
        {title}
        <span className="text-sm text-gray-500">
          {open ? "▲ Ocultar" : "▼ Mostrar"}
        </span>
      </button>

      {open && <div className="p-4">{children}</div>}
    </div>
  );
}

export default CollapseSection;
