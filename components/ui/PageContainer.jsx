export default function PageContainer({
  children,
  className = "",
  narrow = false,
}) {
  return (
    <main
      className={`flex-1 pt-24 pb-28 md:pb-32 mx-auto w-full px-4 md:px-6 ${
        narrow ? "max-w-4xl" : "max-w-6xl"
      } ${className}`}
    >
      {children}
    </main>
  );
}
