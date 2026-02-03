import { useState } from "react";
import { HiMenu } from "react-icons/hi";

function Navbar({ onLogout, setView }) {
  const [openSection, setOpenSection] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

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
        { name: "Escenarios", view: "scenarios" },
        { name: "Metas de ahorro", view: "goals" },
        { name: "Presupuestos", view: "budgets" },
        { name: "Dashh", view: "moderndashboard" },
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
    <nav
      className="
        sticky top-0 z-50
        px-6 py-3
        flex items-center justify-between flex-wrap
        bg-slate-950/85
        backdrop-blur-md
        border-b border-slate-800
        shadow-[0_10px_30px_rgba(0,0,0,0.8)]
      "
    >
      {/* Logo / Brand */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-300 shadow-[0_0_18px_rgba(16,185,129,0.7)]">
          <span className="text-base">💸</span>
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-[0.16em] uppercase text-slate-200">
            FinanceFlow
          </span>
          <span className="text-[11px] text-slate-500">
            Control financiero personal
          </span>
        </div>
      </div>

      {/* Burger Button */}
      <button
        className="
          md:hidden text-2xl text-slate-200
          rounded-lg p-1.5
          hover:bg-slate-900/80
          focus:outline-none focus:ring-2 focus:ring-emerald-500/70
          transition-colors
        "
        onClick={() => setMenuOpen((prev) => !prev)}
      >
        <HiMenu />
      </button>

      {/* Menu */}
      <ul
        className={`
          ${
            menuOpen
              ? "flex flex-col w-full mt-4 space-y-2"
              : "hidden"
          }
          md:flex md:flex-row md:gap-4 lg:gap-6 md:items-center md:ml-auto md:mt-0
        `}
      >
        {/* Dashboard link */}
        <li>
          <button
            onClick={() => {
              setOpenSection(null);
              setView("dashboard");
              setMenuOpen(false);
            }}
            className="
              font-semibold text-xs md:text-sm tracking-[0.16em] uppercase
              text-slate-200
              px-3 py-1.5 rounded-full
              hover:text-emerald-300 hover:bg-slate-900/80
              transition-colors
            "
          >
            Dashboard
          </button>
        </li>

        {/* Secciones con dropdown */}
        {sections.map((section) => {
          const isOpen = openSection === section.title;

          return (
            <li key={section.title} className="relative">
              <button
                onClick={() => handleToggle(section.title)}
                className={`
                  flex items-center gap-1
                  font-semibold text-xs md:text-sm tracking-[0.16em] uppercase
                  px-3 py-1.5 rounded-full
                  transition-colors
                  ${
                    isOpen
                      ? "text-emerald-300 bg-slate-900/80"
                      : "text-slate-200 hover:text-emerald-300 hover:bg-slate-900/70"
                  }
                `}
              >
                <span>{section.title}</span>
                <span
                  className={`
                    text-[10px]
                    transition-transform duration-200
                    ${isOpen ? "rotate-180" : ""}
                  `}
                >
                  ▾
                </span>
              </button>

              {/* Dropdown (Desktop) */}
              {isOpen && (
                <ul
                  className="
                    absolute left-0 mt-3
                    hidden md:block
                    min-w-[190px]
                    rounded-xl
                    bg-slate-950/95
                    border border-slate-800
                    shadow-[0_18px_40px_rgba(0,0,0,0.9)]
                    overflow-hidden
                  "
                >
                  {section.links.map((link) => (
                    <li key={link.view}>
                      <button
                        onClick={() => {
                          setView(link.view);
                          setOpenSection(null);
                        }}
                        className="
                          block w-full text-left
                          px-4 py-2.5
                          text-sm text-slate-200
                          hover:bg-slate-900 hover:text-emerald-300
                          transition-colors
                        "
                      >
                        {link.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Dropdown (Mobile) */}
              {menuOpen && (
                <ul className="md:hidden ml-3 mt-1 space-y-1">
                  {isOpen &&
                    section.links.map((link) => (
                      <li key={link.view}>
                        <button
                          onClick={() => {
                            setView(link.view);
                            setOpenSection(null);
                            setMenuOpen(false);
                          }}
                          className="
                            block w-full text-left
                            px-3 py-2
                            text-sm text-slate-200
                            rounded-lg
                            bg-slate-900/60
                            hover:bg-slate-800 hover:text-emerald-300
                            transition-colors
                          "
                        >
                          {link.name}
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </li>
          );
        })}

        {/* Logout */}
        <li>
          <button
            onClick={onLogout}
            className="
              mt-2 md:mt-0
              rounded-full
              px-4 py-1.5
              text-xs md:text-sm font-semibold
              bg-gradient-to-r from-rose-500 via-rose-500 to-rose-400
              text-white
              shadow-[0_0_18px_rgba(248,113,113,0.7)]
              hover:brightness-110
              active:scale-95
              transition-all
            "
          >
            Cerrar sesión
          </button>
        </li>
      </ul>
    </nav>
  );
}

export default Navbar;
