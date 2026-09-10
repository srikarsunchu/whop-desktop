import { Avatar } from "frosted-ui";
import { useEffect, useState } from "react";
import type { Account } from "../lib/whop";

/**
 * Business avatar: the real logo when the CLI returns one, otherwise Frosted's
 * initials avatar. A plain <img> is used so a slow or blocked load simply
 * falls back instead of staying blank.
 */
export function BizAvatar({ account, size = "1" }: { account: Account | null | undefined; size?: "1" | "2" }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [account?.logo]);
  const title = account?.title ?? "Whop";
  if (account?.logo && !failed) {
    return <img className="biz-logo" data-size={size} src={account.logo} alt="" draggable={false} onError={() => setFailed(true)} />;
  }
  return <Avatar size={size} shape="square" color={account?.demo ? "gray" : "orange"} fallback={title} />;
}
