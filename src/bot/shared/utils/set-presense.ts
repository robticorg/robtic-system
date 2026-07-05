import type { BotClient } from "@core/BotClient";
import { ActivityType, type PresenceStatusData } from "discord.js";
import { Logger } from "@core/libs";

const PRESENCE_INTERVAL = 10000;
// discord.js's ClientPresence#set fires the gateway update without awaiting it, so if the
// shard's websocket isn't fully registered yet (a brief gap right at ClientReady, worse with
// several bots competing for the event loop), it throws an unhandled "Shard not found" — give
// the shard a moment to settle before the first presence update.
const FIRST_APPLY_DELAY = 2000;

export function setPresence(
    client: BotClient,
    status: PresenceStatusData,
    activityType: keyof typeof ActivityType,
    activityNames: string[]
) {
    if (!client.user || activityNames.length === 0) return;

    let index = 0;

    const apply = () => {
        const activity = activityNames[index];

        try {
            client.user?.setPresence({
                status,
                activities: [
                    {
                        name: activity,
                        type: ActivityType[activityType],
                    },
                ],
            });
        } catch (err) {
            Logger.warn(`Presence update skipped: ${err}`, client.botName);
        }

        index = (index + 1) % activityNames.length;
    };

    setTimeout(apply, FIRST_APPLY_DELAY);

    setInterval(apply, PRESENCE_INTERVAL);
}