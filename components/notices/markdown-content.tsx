"use client";

import dynamic from "next/dynamic";

const MDPreview = dynamic(
  () => import("@uiw/react-md-editor").then((m) => m.default.Markdown),
  { ssr: false }
);

export function MarkdownContent({ source }: { source: string }) {
  return (
    <div data-color-mode="light">
      <MDPreview
        source={source}
        style={{
          background: "transparent",
          fontSize: "0.875rem",
          lineHeight: "1.75",
          color: "inherit",
        }}
      />
    </div>
  );
}
