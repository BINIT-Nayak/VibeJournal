"use client";

import { forwardRef, useState, type ComponentPropsWithoutRef } from "react";
import { Eye, EyeOff } from "lucide-react";
import styles from "./AuthLayout.module.css";

type PasswordInputProps = Omit<ComponentPropsWithoutRef<"input">, "type"> & {
  visibilityLabel?: string;
};

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ visibilityLabel = "password", ...props }, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <div className={styles.passwordWrap}>
        <input {...props} ref={ref} type={visible ? "text" : "password"} />
        <button
          className={styles.reveal}
          type="button"
          disabled={props.disabled}
          aria-label={`${visible ? "Hide" : "Show"} ${visibilityLabel}`}
          aria-pressed={visible}
          aria-controls={props.id}
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
    );
  }
);
