import { useState } from "react";
import { HiOutlineEye, HiOutlineEyeOff } from "react-icons/hi";

function PasswordInput({ className = "", disabled = false, ...props }) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? HiOutlineEyeOff : HiOutlineEye;
  const label = visible ? "Ocultar contrasena" : "Mostrar contrasena";

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        disabled={disabled}
        className={`ff-input pr-12 ${className}`.trim()}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        onMouseDown={(event) => event.preventDefault()}
        disabled={disabled}
        aria-label={label}
        title={label}
        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[color-mix(in_srgb,var(--panel-2)_75%,transparent)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}

export default PasswordInput;
