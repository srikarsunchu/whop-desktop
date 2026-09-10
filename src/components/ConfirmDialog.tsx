import { AlertDialog, Button, Code, Text } from "frosted-ui";

/** Every write goes through here: the CLI has no dry-run. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  command,
  confirmLabel = "Run",
  danger,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  command: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={(o: boolean) => onOpenChange(o)}>
      <AlertDialog.Content size="2" style={{ maxWidth: 480 }}>
        <AlertDialog.Title>{title}</AlertDialog.Title>
        <AlertDialog.Description>
          {description && (
            <Text size="2" color="gray" style={{ display: "block", marginBottom: 12 }}>
              {description}
            </Text>
          )}
          <Code size="1" variant="soft" color="gray" style={{ display: "block", padding: "8px 10px", userSelect: "text" }}>
            $ {command}
          </Code>
          <Text size="1" color="gray" style={{ display: "block", marginTop: 12 }}>
            This runs against production. The Whop CLI has no sandbox or dry-run.
          </Text>
        </AlertDialog.Description>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <AlertDialog.Cancel>
            <Button variant="soft" color="gray" size="2">
              Cancel
            </Button>
          </AlertDialog.Cancel>
          <Button variant="classic" color={danger ? "red" : undefined} size="2" onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
