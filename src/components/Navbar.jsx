import { useState, useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";

import { HiMenu } from "react-icons/hi";
import { canUsePremiumBackend } from "../lib/subscription/subscriptionAccess";

function Navbar({ onLogout, setView, subscriptionMode }) {
  const [openSection, setOpenSection] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const navRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const isNativeMobile = Capacitor.getPlatform() !== "web";
  const mobileHiddenViews = new Set(["scenarios"]);

  useEffect(() => {
    function handleClickOutside(event) {
      const clickedOutsideNav =
        navRef.current && !navRef.current.contains(event.target);
      const clickedOutsideMobileMenu =
        mobileMenuRef.current && !mobileMenuRef.current.contains(event.target);

      if (clickedOutsideNav && clickedOutsideMobileMenu) {
        setOpenSection(null);
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 768) {
        setMenuOpen(false);
      }
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const rawSections = [
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
        { name: "Reportes", view: "reports" },
        // { name: "Dashh", view: "moderndashboard" },
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
      links: [
        { name: "Preferencias", view: "preferences" },
        { name: "Tema", view: "theme" },
      ],
    },
  ];

  const sections = rawSections
    .map((section) => ({
      ...section,
      links: section.links.filter(
        (link) =>
          !(
            (link.view === "items" &&
              !canUsePremiumBackend(subscriptionMode)) ||
            (link.view === "reports" &&
              (!isNativeMobile || !canUsePremiumBackend(subscriptionMode))) ||
            (isNativeMobile && mobileHiddenViews.has(link.view))
          )
      ),
    }))
    .filter((section) => section.links.length > 0);

  const handleToggle = (sectionTitle) => {
    setOpenSection((prev) => (prev === sectionTitle ? null : sectionTitle));
  };

  const goToView = (view) => {
    setView(view);
    setOpenSection(null);
    setMenuOpen(false);
  };

  // Helpers de estilo (tokens)
  const navBase =
    "app-safe-top sticky top-0 z-50 px-6 py-3 flex items-center justify-between flex-wrap backdrop-blur-md border-b";
  const navColors =
    "bg-[var(--panel)] border-[var(--border-rgba)] shadow-[0_10px_30px_rgba(0,0,0,0.55)]";

  const linkBase =
    "font-semibold text-xs md:text-sm tracking-[0.16em] uppercase px-3 py-1.5 rounded-full transition-all";
  const linkIdle =
    "text-[var(--text)] hover:text-[var(--primary)] hover:bg-[color-mix(in srgb,var(--panel-2)_75%,transparent)]";
  const linkActive =
    "text-[var(--primary)] bg-[color-mix(in srgb,var(--panel-2)_85%,transparent)]";

  return (
    <>
      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px] md:hidden" />
      )}

      <nav ref={navRef} className={`${navBase} ${navColors}`}>
        {/* Logo / Brand */}
        <div className="flex items-center gap-3">
        <div
          className="
            flex items-center justify-center
            w-10 h-10 rounded-xl
            bg-[color-mix(in srgb,var(--panel)_88%,transparent)]
            overflow-hidden
          "
          title="FinanceFlow"
        >
          <img
            src="/app-icon.webp"
            alt="FinanceFlow"
            className="h-full w-full object-contain"
          />
        </div>

          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-[0.16em] uppercase text-[var(--text)]">
              FinanceFlow
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[var(--muted)]">
                Control financiero personal
              </span>
              {subscriptionMode === "premium_active" && (
                <span
                  className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                  style={{
                    borderColor:
                      "color-mix(in srgb, var(--success) 40%, var(--border-rgba))",
                    background:
                      "color-mix(in srgb, var(--success) 14%, var(--panel))",
                    color: "var(--text)",
                  }}
                >
                  Premium
                </span>
              )}
            </div>
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
          aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={menuOpen}
        >
          <HiMenu />
        </button>

        {/* Menu Desktop */}
        <ul className="hidden md:flex md:flex-row md:gap-4 lg:gap-6 md:items-center md:ml-auto md:mt-0">
          {/* Dashboard link */}
          <li>
            <button
              onClick={() => goToView("dashboard")}
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
                          onClick={() => goToView(link.view)}
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

      {/* Menu Mobile */}
      <aside
        ref={mobileMenuRef}
        className={`
          fixed left-0 z-[60] w-[min(82vw,320px)] md:hidden
          border-r border-[var(--border-rgba)]
          bg-[var(--panel)]
          shadow-[0_18px_40px_rgba(0,0,0,0.65)]
          transition-transform duration-300 ease-out
          ${menuOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        style={{
          top: "var(--app-safe-top)",
          bottom: "var(--app-safe-bottom)",
        }}
      >
        <div className="flex h-full flex-col overflow-y-auto px-5 py-6">
          <ul className="flex flex-col space-y-2">
            <li>
              <button
                onClick={() => goToView("dashboard")}
                className={`${linkBase} ${linkIdle} w-full text-left`}
              >
                Dashboard
              </button>
            </li>

            {sections.map((section) => {
              const isOpen = openSection === section.title;

              return (
                <li key={section.title}>
                  <button
                    onClick={() => handleToggle(section.title)}
                    className={`${linkBase} ${
                      isOpen ? linkActive : linkIdle
                    } flex w-full items-center justify-between`}
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

                  {isOpen && (
                    <ul className="mt-2 space-y-1 pl-3">
                      {section.links.map((link) => (
                        <li key={link.view}>
                          <button
                            onClick={() => goToView(link.view)}
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
          </ul>

          <button
            onClick={onLogout}
            className="
              mt-auto rounded-full px-4 py-2
              text-sm font-semibold
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
        </div>
      </aside>
    </>
  );
}

export default Navbar;
