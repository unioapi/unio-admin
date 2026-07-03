import { useState } from "react";
import type { Channel } from "@/lib/api/channels";
import { ChannelLastTestDetail } from "@/components/channels/ChannelLastTest";
import { ChannelTestDialog } from "@/components/channels/ChannelTestDialog";
import { Button } from "@/components/ui/button";

export function ChannelTestSection({ channel }: { channel: Channel }) {
  const [testOpen, setTestOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <ChannelLastTestDetail info={channel} />
      <div>
        <Button type="button" size="sm" onClick={() => setTestOpen(true)}>
          发起检测
        </Button>
      </div>
      <ChannelTestDialog open={testOpen} onOpenChange={setTestOpen} channel={channel} />
    </div>
  );
}
