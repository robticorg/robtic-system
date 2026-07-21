import type { CommandConfig } from "@core/config";
import { FULL_POWER_ROLE_IDS, SUPER_ADMIN_ID } from "@core/config";
import { isOnCooldown, getRemainingCooldown, clearCooldown, errorEmbed } from "@core/utils";
import { ChatInputCommandInteraction, MessageFlags, type GuildMember, type Interaction, type InteractionReplyOptions } from "discord.js";
import type { BotClient } from "@core/BotClient";
import { BotError, handleError, classifyError } from "@core/handlers";
import { getMemberLevel, isInDepartment } from "@shared/utils/access";
import { hasCommandAccessGrant } from "@shared/utils/commandAccess";
import { SuperUserRepository } from "@database/repositories";

export const HandlingComponent = async (interaction: Interaction, client: BotClient): Promise<boolean> => {
    if (
        interaction.isButton() ||
        interaction.isStringSelectMenu() ||
        interaction.isRoleSelectMenu() ||
        interaction.isModalSubmit()
    ) {
        const customId = interaction.customId;

        for (const [, handler] of client.components) {
            const pattern =
                handler.customId instanceof RegExp
                    ? handler.customId
                    : new RegExp(`^${handler.customId}$`);

            if (pattern.test(customId)) {
                try {
                    await handler.run(interaction as any, client);
                } catch (error) {
                    const classified = classifyError(error);
                    handleError(
                        new BotError(`[${classified.label}] Error handling component "${customId}": ${classified.detail}`, "EVENT"),
                        `${client.botName}/InteractionCreate`
                    );

                    // Interaction token already dead — replying would just fail the same way.
                    if (classified.category === "interaction_expired") return true;

                    try {
                        if (!interaction.replied && !interaction.deferred) {
                            await interaction.reply({
                                embeds: [errorEmbed(classified.userMessage)],
                                flags: MessageFlags.Ephemeral,
                            });
                        }
                    } catch {
                        // Interaction already acknowledged or expired — suppress to avoid client error noise
                    }
                }
                return true;
            }
        }
        if (!interaction.replied && !interaction.deferred) {
            try {
                await interaction.reply({
                    embeds: [errorEmbed("This action is no longer available. Please try again.")],
                    flags: MessageFlags.Ephemeral,
                });
            } catch {
                // Ignore interaction lifecycle race conditions.
            }
        }
        return true;
    }

    return false;
}

export const checkPermissions = async (intract: Interaction, command: CommandConfig): Promise<boolean> => {
    let interaction = intract as ChatInputCommandInteraction;

    if (interaction.user.id === SUPER_ADMIN_ID) return true;

    const member = interaction.member as GuildMember | null;

    // Run concurrently — every ms here before the command's own deferReply() eats into Discord's
    // ~3s ack window. Precedence below is unchanged from the old sequential version.
    const [isWhitelisted, hasGrant] = await Promise.all([
        SuperUserRepository.isWhitelisted(interaction.user.id),
        member && interaction.guildId ? hasCommandAccessGrant(interaction.guildId, interaction.commandName, member) : Promise.resolve(false),
    ]);

    if (isWhitelisted) return true;

    if (!member) {
        await interaction.reply({
            embeds: [errorEmbed("This command can only be used in a server.")],
            flags: MessageFlags.Ephemeral,
        });
        scheduleDeletion(() => interaction.deleteReply());
        return false;
    }

    if (FULL_POWER_ROLE_IDS.some(id => member.roles.cache.has(id))) return true;

    // Per-guild /command-access grant — an additional way in, on top of the check below.
    if (hasGrant) return true;

    const { score } = await getMemberLevel(member);

    if (score >= 90) return true;

    if (command.requiredPermission && score < command.requiredPermission) {
        await interaction.reply({
            embeds: [errorEmbed("You don't have permission to use this command.")],
            flags: MessageFlags.Ephemeral,
        });
        scheduleDeletion(() => interaction.deleteReply());
        return false;
    }

    if (command.department && !(await isInDepartment(member, command.department))) {
        await interaction.reply({
            embeds: [errorEmbed(`This command is restricted to the ${command.department} department.`)],
            flags: MessageFlags.Ephemeral,
        });
        scheduleDeletion(() => interaction.deleteReply());
        return false;
    }

    return true;
}

/** Namespaced by bot name — the cooldown store is a single shared singleton, so e.g. moderation's /mod and modmail's /mod don't share a timer. */
function getCooldownKey(interaction: ChatInputCommandInteraction, client: BotClient): string {
    const parts = [client.botName, interaction.commandName];
    try {
        const group = interaction.options.getSubcommandGroup(false);
        if (group) parts.push(group);
        const sub = interaction.options.getSubcommand(false);
        if (sub) parts.push(sub);
    } catch {
        // Command has no subcommands defined — fall back to the base command name.
    }
    return parts.join(":");
}

/** Auto-deletes a bot error reply after a few seconds so it doesn't linger in chat. */
const ERROR_REPLY_LIFETIME_MS = 3_000;
function scheduleDeletion(deleteFn: () => Promise<unknown>): void {
    setTimeout(() => {
        deleteFn().catch(() => null);
    }, ERROR_REPLY_LIFETIME_MS);
}

export const cooldowns = async (intract: Interaction, command: CommandConfig, client: BotClient): Promise<boolean> => {
    let interaction = intract as ChatInputCommandInteraction;

    const cooldownMs = (command.cooldown ?? 5) * 1000;
    const scopeId = interaction.guildId ?? "dm";
    const cooldownKey = getCooldownKey(interaction, client);
    if (isOnCooldown(interaction.user.id, cooldownKey, cooldownMs, scopeId)) {
        const remaining = getRemainingCooldown(interaction.user.id, cooldownKey, cooldownMs, scopeId);
        await interaction.reply({
            embeds: [errorEmbed(`Please wait ${remaining}s before using this command again.`)],
            flags: MessageFlags.Ephemeral,
        });
        scheduleDeletion(() => interaction.deleteReply());
        return false;
    }
    return true;
}

/** Rolls back the cooldown charged for this interaction, for use when the command failed to actually run to completion. */
export const releaseCooldown = (intract: Interaction, client: BotClient): void => {
    const interaction = intract as ChatInputCommandInteraction;
    const scopeId = interaction.guildId ?? "dm";
    clearCooldown(interaction.user.id, getCooldownKey(interaction, client), scopeId);
}

export const commandError = async (error: unknown, intract: Interaction, client: BotClient) => {
    let interaction = intract as ChatInputCommandInteraction;
    const classified = classifyError(error);

    handleError(
        new BotError(`[${classified.label}] Error running "${interaction.commandName}": ${classified.detail}`, "COMMAND"),
        `${client.botName}/InteractionCreate`
    );

    // Already dead — a reply attempt would just fail the same way and add a misleading second log.
    if (classified.category === "interaction_expired") return;

    const reply: InteractionReplyOptions = {
        embeds: [errorEmbed(classified.userMessage)],
        flags: MessageFlags.Ephemeral,
    };

    try {
        if (interaction.replied || interaction.deferred) {
            const msg = await interaction.followUp(reply);
            if (msg) scheduleDeletion(() => msg.delete());
        } else {
            await interaction.reply(reply);
            scheduleDeletion(() => interaction.deleteReply());
        }
    } catch {
        // Interaction already acknowledged or expired — suppress to avoid client error noise
    }
}