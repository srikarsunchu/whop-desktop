import React from "react";
import ReactDOM from "react-dom/client";
import "frosted-ui/styles.css";
import "@fontsource-variable/inter";
import "@fontsource-variable/geist-mono";
import "./styles.css";
import { Button, Code, Heading, Text, Theme, Toaster } from "frosted-ui";
import { App } from "./App";

/** A render error shows a message instead of a blank window. */
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ padding: 48, maxWidth: 640 }}>
        <Heading size="5" weight="medium">
          Something broke in the interface
        </Heading>
        <Text size="2" color="gray" style={{ display: "block", margin: "8px 0 16px" }}>
          The Whop CLI and your data are fine. This is a bug in Whop Desktop; please report it with the message below.
        </Text>
        <Code size="1" variant="soft" color="gray" style={{ display: "block", padding: 12, userSelect: "text", whiteSpace: "pre-wrap" }}>
          {String(this.state.error?.stack ?? this.state.error)}
        </Code>
        <div style={{ marginTop: 16 }}>
          <Button variant="classic" size="2" onClick={() => location.reload()}>
            Reload
          </Button>
        </div>
      </div>
    );
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Theme appearance="dark" grayColor="gray" accentColor="blue" successColor="green" dangerColor="red" warningColor="amber">
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
      <Toaster position="bottom-right" />
    </Theme>
  </React.StrictMode>,
);
