import type { Message } from "discord.js";
import { isFeatureEnabled } from "@core/features";
import { buildInfoView } from "../utils/info-view";
import { buildInvitesEmbed } from "../utils/invites-view";
import { orInvitesUnavailable } from "../utils/service-errors";
import { isTicketChannel } from "../utils/ticket-channels";
import type { TicketQuery } from "../utils/invite-format";

/**
 * Answers a bare `info @user` / `invites @user` typed in a ticket channel, exactly as the slash
 * commands would. Returns quietly for any other channel, an unknown user, or the feature disabled.
 */
export async function answerTicketQuery(message: Message<true>, query: TicketQuery): Promise<void> {
    const { guild } = message;
    if (!("name" in message.channel) || !(await isTicketChannel(guild, message.channel.id, message.channel.name))) return;
    if (!(await isFeatureEnabled(guild.id, "invites"))) return;

    const target = query.userId
        ? await message.client.users.fetch(query.userId).catch(() => null)
        : message.author;
    if (!target) return;

    const reply = await orInvitesUnavailable(async () => query.kind === "invites"
        ? { embeds: [await buildInvitesEmbed(guild.id, guild.name, message.author.id, target)] }
        : await buildInfoView(guild.id, message.author.id, target, 0));

    await message.reply({ ...reply, allowedMentions: { parse: [], repliedUser: false } });
}
