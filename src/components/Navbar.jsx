import { useState, useEffect, useRef } from "react";

import { HiMenu } from "react-icons/hi";

function Navbar({ onLogout, setView }) {
  const [openSection, setOpenSection] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const navRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (navRef.current && !navRef.current.contains(event.target)) {
        setOpenSection(null);
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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
    {
      title: "Configuración",
      links: [{ name: "Tema", view: "theme" }],
    },
  ];

  const handleToggle = (sectionTitle) => {
    setOpenSection((prev) => (prev === sectionTitle ? null : sectionTitle));
  };

  // Helpers de estilo (tokens)
  const navBase =
    "sticky top-0 z-50 px-6 py-3 flex items-center justify-between flex-wrap backdrop-blur-md border-b";
  const navColors =
    "bg-[var(--panel)] border-[var(--border-rgba)] shadow-[0_10px_30px_rgba(0,0,0,0.55)]";

  const linkBase =
    "font-semibold text-xs md:text-sm tracking-[0.16em] uppercase px-3 py-1.5 rounded-full transition-all";
  const linkIdle =
    "text-[var(--text)] hover:text-[var(--primary)] hover:bg-[color-mix(in srgb,var(--panel-2)_75%,transparent)]";
  const linkActive =
    "text-[var(--primary)] bg-[color-mix(in srgb,var(--panel-2)_85%,transparent)]";

  return (
    <nav ref={navRef} className={`${navBase} ${navColors}`}>
      {/* Logo / Brand */}
      <div className="flex items-center gap-3">
        <div
          className="
            flex items-center justify-center
            w-9 h-9 rounded-xl
            bg-[var(--primary)]
            shadow-[var(--glow-shadow)]
          "
          title="FinanceFlow"
        >
          <span className="text-base">💸</span>
        </div>

        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-[0.16em] uppercase text-[var(--text)]">
            FinanceFlow
          </span>
          <span className="text-[11px] text-[var(--muted)]">
            Control financiero personal
          </span>
        </div>
      </div>

      {/* Burger Button */}
      <button
        className="
          md:hidden text-2xl
          rounded-lg p-1.5
          text-[var(--text)]
          hover:bg-[color-mix(in srgb,var(--panel-2)_75%,transparent)]
          focus:outline-none focus:ring-2
          focus:ring-[var(--ring)]
          transition-colors
        "
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-label="Abrir menú"
      >
        <HiMenu />
      </button>

      {/* Menu */}
      <ul
        className={`
          ${menuOpen ? "flex flex-col w-full mt-4 space-y-2" : "hidden"}
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
            className={`${linkBase} ${linkIdle}`}
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
                className={`${linkBase} ${
                  isOpen ? linkActive : linkIdle
                } flex items-center gap-1`}
              >
                <span>{section.title}</span>
                <span
                  className={`text-[10px] transition-transform duration-200 ${
                    isOpen ? "rotate-180" : ""
                  }`}
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
      overflow-hidden
      rounded-xl
      border
      border-[var(--border-rgba)]
      bg-[var(--panel-2)]
      shadow-[0_18px_40px_rgba(0,0,0,0.65)]
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
            text-sm
            text-[var(--text)]
            hover:text-[var(--primary)]
            hover:bg-[color-mix(in srgb,var(--panel-2)_92%,#000)]
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
                            text-sm
                            rounded-lg
                            border border-[var(--border-rgba)]
                            bg-[color-mix(in srgb,var(--panel-2)_70%,transparent)]
                            text-[var(--text)]
                            hover:text-[var(--primary)]
                            hover:bg-[color-mix(in srgb,var(--panel-2)_85%,transparent)]
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
    rounded-full px-4 py-1.5
    text-xs md:text-sm font-semibold
    bg-[var(--danger)]
    text-[color-mix(in srgb,var(--text)_10%,white)]
    shadow-[0_0_18px_color-mix(in srgb,var(--danger)_70%,transparent)]
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
