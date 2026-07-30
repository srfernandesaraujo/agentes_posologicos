import { useEffect, useState } from "react";

// Temporary diagnostic tool for the iOS Safari layout-gap investigation.
// Only renders with ?debug=1 in the URL. Safe to remove once that bug is confirmed fixed.
export function DebugOverlay() {
  const [info, setInfo] = useState<string[]>([]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("debug") !== "1") return;

    const collect = () => {
      const lines: string[] = [];
      const html = document.documentElement;
      const body = document.body;
      const flexWrap = body.querySelector<HTMLElement>("body > div > div.flex");
      const main = body.querySelector<HTMLElement>("main");
      const bodyStyle = getComputedStyle(body);
      const htmlStyle = getComputedStyle(html);

      lines.push(`innerWidth: ${window.innerWidth}`);
      lines.push(`visualViewport.width: ${window.visualViewport?.width}`);
      lines.push(`html.clientWidth: ${html.clientWidth}`);
      lines.push(`html.scrollWidth: ${html.scrollWidth}`);
      lines.push(`body.clientWidth: ${body.clientWidth}`);
      lines.push(`body.scrollWidth: ${body.scrollWidth}`);
      lines.push(`body rect.width: ${body.getBoundingClientRect().width.toFixed(1)}`);
      lines.push(`body inline style: ${body.getAttribute("style") || "(none)"}`);
      lines.push(`body computed padding-right: ${bodyStyle.paddingRight}`);
      lines.push(`body computed overflow-x: ${bodyStyle.overflowX}`);
      lines.push(`html computed overflow-x: ${htmlStyle.overflowX}`);
      lines.push(`body data-scroll-locked: ${body.getAttribute("data-scroll-locked") ?? "(none)"}`);
      lines.push(`flexWrap rect: ${flexWrap ? JSON.stringify(flexWrap.getBoundingClientRect()) : "not found"}`);
      lines.push(`main rect: ${main ? JSON.stringify(main.getBoundingClientRect()) : "not found"}`);
      lines.push(`devicePixelRatio: ${window.devicePixelRatio}`);
      setInfo(lines);
    };

    collect();
    const id = setInterval(collect, 1000);
    return () => clearInterval(id);
  }, []);

  if (info.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 999999,
        background: "rgba(255,0,0,0.9)",
        color: "white",
        fontSize: "10px",
        fontFamily: "monospace",
        padding: "6px",
        maxWidth: "100vw",
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
      }}
    >
      {info.join("\n")}
    </div>
  );
}
