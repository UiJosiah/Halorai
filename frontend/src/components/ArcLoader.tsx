import "./ArcLoader.css";

import type { ReactNode } from "react";

type Props = {
  size?: number;
  label?: ReactNode;
  spinning?: boolean;
  spinDurationMs?: number;
  pinkColor?: string;
  yellowColor?: string;
  className?: string;
};

export default function ArcLoader({
  size = 180,
  label = "Processing...",
  spinning = true,
  spinDurationMs = 2600,
  pinkColor = "#FFCCEF",
  yellowColor = "#FFF7E2",
  className,
}: Props) {
  return (
    <div
      className={`arcLoader ${className ?? ""}`}
      style={{ width: size, height: size, ["--arcLoaderSpinDuration" as any]: `${spinDurationMs}ms` }}
    >
      <svg
        className="arcLoader__svg"
        width={size}
        height={size}
        viewBox="0 0 269 269"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Static background ring (yellow) */}
        <path
          d="M269 134.5C269 208.782 208.782 269 134.5 269C60.2177 269 0 208.782 0 134.5C0 60.2177 60.2177 0 134.5 0C208.782 0 269 60.2177 269 134.5ZM26.7967 134.5C26.7967 193.983 75.0171 242.203 134.5 242.203C193.983 242.203 242.203 193.983 242.203 134.5C242.203 75.0171 193.983 26.7967 134.5 26.7967C75.0171 26.7967 26.7967 75.0171 26.7967 134.5Z"
          fill={yellowColor}
        />

        {/* Rotating foreground arc (pink) - reuses provided path */}
        <g className={`arcLoader__spin ${spinning ? "arcLoader__spin--on" : ""}`}>
          <path
            d="M255.602 128.803C263.001 128.803 269.069 134.817 268.333 142.18C266.263 162.895 259.404 182.911 248.224 200.616C234.652 222.109 215.267 239.316 192.315 250.243C169.364 261.17 143.786 265.369 118.546 262.354C93.3053 259.339 69.4362 249.232 49.7045 233.206C29.9729 217.181 15.1867 195.891 7.05954 171.806C-1.06763 147.72 -2.20299 121.824 3.78503 97.1199C9.77304 72.4155 22.6393 49.9137 40.8926 32.2224C55.9287 17.6492 74.1132 6.83177 93.9629 0.557549C101.019 -1.67263 108.149 3.03303 109.666 10.2755C111.184 17.5179 106.502 24.5398 99.5043 26.9442C84.5961 32.0662 70.9396 40.4179 59.5422 51.4644C44.9255 65.6311 34.6226 83.6498 29.8276 103.432C25.0326 123.215 25.9418 143.951 32.4498 163.238C38.9577 182.525 50.7981 199.573 66.5985 212.406C82.399 225.239 101.513 233.332 121.724 235.746C141.936 238.161 162.418 234.798 180.797 226.049C199.176 217.299 214.699 203.52 225.567 186.309C234.041 172.888 239.415 157.809 241.371 142.167C242.289 134.825 248.202 128.803 255.602 128.803Z"
            transform="translate(0 6)"
            fill={pinkColor}
          />
        </g>
      </svg>

      <div className="arcLoader__label">
        <div className="text-xs md:text-sm font-medium text-[hsl(0,0%,35%)] leading-tight">{label}</div>
      </div>
    </div>
  );
}

