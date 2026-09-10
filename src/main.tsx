import React from "react";
import ReactDOM from "react-dom/client";
import "frosted-ui/styles.css";
import "@fontsource-variable/inter";
import "@fontsource-variable/geist-mono";
import "./styles.css";
import { Theme, Toaster } from "frosted-ui";
import { App } from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Theme appearance="dark" grayColor="gray" accentColor="blue" successColor="green" dangerColor="red" warningColor="amber">
      <App />
      <Toaster position="bottom-right" />
    </Theme>
  </React.StrictMode>,
);
