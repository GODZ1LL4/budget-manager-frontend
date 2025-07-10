import { useState } from "react";

function Navbar({ onLogout, setView }) {
  const [openSection, setOpenSection] = useState(null);

  const sections = [
    {
      title: "Definiciones",
      links: [
        { name: "Artículos", view: "items" },
        { name: "Categorías", view: "categories" },
      ],
    },
    {
      title: "Gestión Financiera",
      links: [
        { name: "Metas de ahorro", view: "goals" },
        { name: "Presupuestos", view: "budgets" },
      ],
    },

    {
      title: "Operaciones",
      links: [
        { name: "Cuentas", view: "accounts" },
        { name: "Transacciones", view: "transactions" },
      ],
    },
  ];

  const handleToggle = (sectionTitle) => {
    setOpenSection((prev) => (prev === sectionTitle ? null : sectionTitle));
  };

  return (
    <nav className="bg-blue-900 text-white px-6 py-4 shadow-md flex items-center justify-between relative">
      <h1 className="text-xl font-bold text-yellow-400 flex items-center gap-2">
        💸 Flujo Personal
      </h1>

      <ul className="hidden md:flex gap-6 items-center relative">
        <li>
          <button
            onClick={() => {
              setOpenSection(null);
              setView("dashboard");
            }}
            className="hover:text-yellow-300 font-semibold"
          >
            DASHBOARD
          </button>
        </li>

        {sections.map((section) => (
          <li key={section.title} className="relative">
            <button
              onClick={() => handleToggle(section.title)}
              className={`font-semibold uppercase hover:text-yellow-300 ${
                openSection === section.title ? "text-yellow-300" : ""
              }`}
            >
              {section.title} ⌄
            </button>

            {openSection === section.title && (
              <ul className="absolute left-0 mt-2 bg-blue-600 rounded shadow-md z-50 min-w-[150px]">
                {section.links.map((link) => (
                  <li key={link.view}>
                    <button
                      onClick={() => {
                        setView(link.view);
                        setOpenSection(null);
                      }}
                      className="block px-4 py-2 hover:bg-blue-700 w-full text-left"
                    >
                      {link.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}

        <li>
          <button
            onClick={onLogout}
            className="bg-blue-500 hover:bg-blue-400 text-white px-3 py-1 rounded font-semibold"
          >
            Cerrar sesión
          </button>
        </li>
      </ul>
    </nav>
  );
}

export default Navbar;
