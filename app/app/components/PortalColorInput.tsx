"use client";

import { useState } from "react";

type Props = {
  name: string;
  initialValue: string;
  label: string;
};

export default function PortalColorInput({ name, initialValue, label }: Props) {
  const [value, setValue] = useState(initialValue);
  return (
    <span className="portal-color-control">
      <input className="portal-color-input" name={name} type="color" value={value} onChange={(event) => setValue(event.target.value)} aria-label={label} />
      <code>{value.toUpperCase()}</code>
    </span>
  );
}
