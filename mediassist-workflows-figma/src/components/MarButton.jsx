export default function MarButton({
  children,
  variant = "primary",
  className = "",
  onClick,
  type = "button",
}) {
  const variants = {
    primary: "bg-mar-primary text-white hover:bg-[#2475ef]",
    subtle: "bg-mar-subtle text-mar-text hover:bg-[#e7edf5]",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      className={[
        "h-9 rounded-[6px] px-4 text-[12px] font-normal leading-[1.45]",
        "transition-colors duration-150",
        variants[variant],
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}
