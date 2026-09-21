import { Button, Dialog, Text, TextField, toast } from "frosted-ui";
import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { invalidateAll, useAccount } from "../lib/whop";

/**
 * Adds an API-key profile to the Whop CLI. Some resources (webhooks) are only
 * authorised for API keys, never for the OAuth token the browser sign-in
 * creates. The key goes straight to the Rust side, which hands it to the CLI
 * through an environment variable; the web page never stores it.
 */
export function ApiKeyDialog({ open, onOpenChange, reason }: { open: boolean; onOpenChange: (o: boolean) => void; reason?: string }) {
  const { account, refreshAccounts } = useAccount();
  const [profile, setProfile] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const suggested = account && !account.demo ? `${account.route ?? account.id}-api` : "api-key";

  async function submit() {
    setBusy(true);
    setError("");
    try {
      await invoke("whop_login_api_key", { apiKey, profile: profile.trim() || suggested });
      setApiKey("");
      invalidateAll();
      await refreshAccounts();
      toast.success("API key connected");
      onOpenChange(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o: boolean) => { if (!busy) onOpenChange(o); }}>
      <Dialog.Content className="workspace-dialog" style={{ maxWidth: 520 }}>
        <Dialog.Title>Connect an API key</Dialog.Title>
        <Dialog.Description>
          {reason ?? "Webhooks and a few other resources are only available to API keys, not to the browser sign-in."}{" "}
          Create a key for this business in the Whop dashboard under Developer → API keys, then paste it here. It becomes a new CLI profile
          you can switch to from Account.
        </Dialog.Description>
        <form onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <fieldset disabled={busy}>
            <div className="workspace-form" style={{ gridTemplateColumns: "1fr" }}>
              <label className="workspace-field">
                Profile name
                <TextField.Root size="2" variant="surface">
                  <TextField.Input value={profile} placeholder={suggested} onChange={(e) => setProfile(e.target.value)} autoComplete="off" spellCheck={false} />
                </TextField.Root>
                <small>How this login shows up in <code>whop auth list</code>.</small>
              </label>
              <label className="workspace-field">
                API key
                <TextField.Root size="2" variant="surface">
                  <TextField.Input type="password" value={apiKey} placeholder="whop_…" onChange={(e) => setApiKey(e.target.value)} autoComplete="off" spellCheck={false} required />
                </TextField.Root>
                <small>Stored by the Whop CLI in its own profile store, not by this app.</small>
              </label>
            </div>
          </fieldset>
          {error && <p role="alert" className="workspace-error">{error}</p>}
          <Text size="1" color="gray" style={{ display: "block", marginTop: 8 }}>
            Runs <code>whop auth login --method api-key</code>. The new profile becomes the active one.
          </Text>
          <div className="workspace-dialog-actions">
            <Button type="button" variant="soft" color="gray" size="2" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="classic" size="2" loading={busy} disabled={!apiKey.trim()}>Connect</Button>
          </div>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}
