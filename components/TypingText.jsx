import { useEffect, useState } from "react";

export default function TypingText({ text, speed = 35 }) {
  const [displayed, setDisplayed] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index < text.length) {
      const timeout = setTimeout(() => {
        setDisplayed((prev) => prev + text[index]);
        setIndex(index + 1);
      }, speed);
      return () => clearTimeout(timeout);
    }
  }, [index, text, speed]);

  return (
    <span className="border-r-2 border-blue-400 pr-1 animate-pulse" aria-live="polite">
      {displayed}
    </span>
  );
}
