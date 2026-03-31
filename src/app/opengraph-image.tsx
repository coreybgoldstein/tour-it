import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Tour It — Scout Before You Play";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#07100a",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
        }}
      >
        {/* Golf ball icon */}
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: "50%",
            background: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 64,
          }}
        >
          ⛳
        </div>

        {/* App name */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              fontSize: 96,
              fontWeight: 900,
              color: "#ffffff",
              letterSpacing: "-2px",
              lineHeight: 1,
            }}
          >
            Tour It
          </div>
          <div
            style={{
              fontSize: 36,
              color: "#4da862",
              fontWeight: 400,
              letterSpacing: "2px",
            }}
          >
            Scout Before You Play
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
