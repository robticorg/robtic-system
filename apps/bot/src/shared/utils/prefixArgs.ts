import { ApplicationCommandOptionType, type Message, type User, type Role, type GuildBasedChannel } from "discord.js";
import type { CommandConfig } from "@core/config";
import type { BotClient } from "@core/BotClient";

interface OptionJSON {
    name: string;
    type: number;
    required?: boolean;
    channel_types?: number[];
    options?: OptionJSON[];
}

interface CommandJSON {
    name: string;
    options?: OptionJSON[];
}

interface ParseResult {
    interaction?: any;
    error?: string;
}

function splitFirstWord(text: string): [string, string] {
    const trimmed = text.trimStart();
    const idx = trimmed.search(/\s/);
    if (idx === -1) return [trimmed, ""];
    return [trimmed.slice(0, idx), trimmed.slice(idx + 1)];
}

function usageLine(prefix: string, name: string, subGroup: string | null, sub: string | null, leaf: OptionJSON[]): string {
    const parts = [prefix + name];
    if (subGroup) parts.push(subGroup);
    if (sub) parts.push(sub);
    for (const opt of leaf) parts.push(opt.required ? `<${opt.name}>` : `[${opt.name}]`);
    return `\`${parts.join(" ")}\``;
}

async function resolveOptionValue(message: Message, opt: OptionJSON, token: string): Promise<unknown> {
    switch (opt.type) {
        case ApplicationCommandOptionType.String:
            return token;

        case ApplicationCommandOptionType.Integer:
        case ApplicationCommandOptionType.Number: {
            const n = Number(token);
            return Number.isFinite(n) ? n : undefined;
        }

        case ApplicationCommandOptionType.Boolean: {
            const v = token.toLowerCase();
            if (["true", "yes", "y", "1", "on"].includes(v)) return true;
            if (["false", "no", "n", "0", "off"].includes(v)) return false;
            return undefined;
        }

        case ApplicationCommandOptionType.User: {
            const match = token.match(/^<@!?(\d+)>$/);
            const id = match ? match[1] : token;
            if (!/^\d{15,25}$/.test(id)) return undefined;
            const member = message.guild ? await message.guild.members.fetch(id).catch(() => null) : null;
            const user: User | null = member?.user ?? (await message.client.users.fetch(id).catch(() => null));
            return user ?? undefined;
        }

        case ApplicationCommandOptionType.Role: {
            const match = token.match(/^<@&(\d+)>$/);
            const id = match ? match[1] : token;
            if (!/^\d{15,25}$/.test(id)) return undefined;
            const role: Role | null | undefined =
                message.guild?.roles.cache.get(id) ?? (await message.guild?.roles.fetch(id).catch(() => null));
            return role ?? undefined;
        }

        case ApplicationCommandOptionType.Channel: {
            const match = token.match(/^<#(\d+)>$/);
            const id = match ? match[1] : token;
            if (!/^\d{15,25}$/.test(id)) return undefined;
            const channel: GuildBasedChannel | null | undefined =
                message.guild?.channels.cache.get(id) ?? (await message.guild?.channels.fetch(id).catch(() => null));
            if (!channel) return undefined;
            if (opt.channel_types?.length && !opt.channel_types.includes(channel.type)) return undefined;
            return channel;
        }

        default:
            return undefined;
    }
}

function buildFakeInteraction(
    message: Message,
    client: BotClient,
    commandName: string,
    subcommandGroup: string | null,
    subcommand: string | null,
    values: Map<string, unknown>
): any {
    let sentMessage: Message | null = null;

    async function sendOrEdit(payload: any): Promise<Message | null> {
        const { flags: _flags, ...rest } = payload ?? {};
        if (sentMessage) {
            sentMessage = await sentMessage.edit(rest).catch(() => sentMessage);
            return sentMessage;
        }
        sentMessage = await message
            .reply({ ...rest, allowedMentions: rest.allowedMentions ?? { repliedUser: false } })
            .catch(() => null);
        return sentMessage;
    }

    const getValue = (name: string, required: boolean) => {
        const v = values.get(name);
        if ((v === undefined || v === null) && required) throw new Error(`Missing option "${name}"`);
        return v ?? null;
    };

    const fake: any = {
        commandName,
        user: message.author,
        member: message.member,
        guild: message.guild,
        guildId: message.guildId,
        channelId: message.channelId,
        channel: message.channel,
        client,
        deferred: false,
        replied: false,
        // Not a genuine Interaction — can't showModal(). Commands check this flag to fall back to a DM+button flow instead.
        isPrefix: true,

        options: {
            getSubcommand: (required = true) => {
                if (!subcommand && required) throw new Error("No subcommand specified");
                return subcommand;
            },
            getSubcommandGroup: (required = false) => {
                if (!subcommandGroup && required) throw new Error("No subcommand group specified");
                return subcommandGroup;
            },
            getString: (name: string, required = false) => getValue(name, required),
            getInteger: (name: string, required = false) => getValue(name, required),
            getBoolean: (name: string, required = false) => getValue(name, required),
            getUser: (name: string, required = false) => getValue(name, required),
            getChannel: (name: string, required = false) => getValue(name, required),
            getRole: (name: string, required = false) => getValue(name, required),
        },

        async deferReply() {
            fake.deferred = true;
        },
        async reply(opts: any) {
            fake.replied = true;
            await sendOrEdit(opts);
        },
        async editReply(opts: any) {
            fake.replied = true;
            await sendOrEdit(opts);
        },
        async deleteReply() {
            if (sentMessage) {
                await sentMessage.delete().catch(() => null);
                sentMessage = null;
            }
        },
        async followUp(opts: any) {
            const { flags: _flags, ...rest } = opts ?? {};
            if (!message.channel.isSendable()) return null;
            return message.channel.send(rest).catch(() => null);
        },
    };

    return fake;
}

/**
 * Parses a prefix command's raw argument string against its slash command's registered option
 * schema (`command.data.toJSON()`), then builds a duck-typed stand-in for `ChatInputCommandInteraction`
 * so the existing `command.run(interaction, client)` bodies work unmodified from either entry point.
 * `run`'s parameter type is already `any` in `CommandConfig`, so no interaction/discord.js typing
 * needs to be satisfied — only the runtime shape commands actually call.
 */
export async function buildPrefixInteraction(
    message: Message,
    client: BotClient,
    command: CommandConfig,
    argString: string,
    prefix: string
): Promise<ParseResult> {
    const json = (command.data as any).toJSON() as CommandJSON;
    let schema = json.options ?? [];
    let rest = argString;
    let subcommandGroup: string | null = null;
    let subcommand: string | null = null;

    // Top-level options can be a mix of bare subcommands and subcommand-group siblings
    // (e.g. streak-config has both `channel <sub>`/`reminder <sub>` groups AND flat
    // subcommands like `settings`/`return`/`sync`) — resolve whichever the first word matches.
    const isSubOrGroup = (o: OptionJSON) =>
        o.type === ApplicationCommandOptionType.Subcommand || o.type === ApplicationCommandOptionType.SubcommandGroup;

    if (schema.some(isSubOrGroup)) {
        const [word, tail] = splitFirstWord(rest);
        const matched = schema.find(o => isSubOrGroup(o) && o.name === word.toLowerCase());
        if (!matched) {
            const names = schema.filter(isSubOrGroup).map(o => o.name).join(", ");
            return { error: `Missing/unknown subcommand. Expected one of: ${names}` };
        }
        rest = tail;

        if (matched.type === ApplicationCommandOptionType.SubcommandGroup) {
            subcommandGroup = matched.name;
            const groupOptions = matched.options ?? [];
            const [word2, tail2] = splitFirstWord(rest);
            const sub = groupOptions.find(o => o.type === ApplicationCommandOptionType.Subcommand && o.name === word2.toLowerCase());
            if (!sub) {
                const names2 = groupOptions.filter(o => o.type === ApplicationCommandOptionType.Subcommand).map(o => o.name).join(", ");
                return { error: `Missing/unknown subcommand in group "${matched.name}". Expected one of: ${names2}` };
            }
            subcommand = sub.name;
            schema = sub.options ?? [];
            rest = tail2;
        } else {
            subcommand = matched.name;
            schema = matched.options ?? [];
        }
    }

    const leaf = schema;
    const values = new Map<string, unknown>();

    for (let i = 0; i < leaf.length; i++) {
        const opt = leaf[i];
        const isLastString = i === leaf.length - 1 && opt.type === ApplicationCommandOptionType.String;

        let token: string;
        if (isLastString) {
            token = rest.trim();
            rest = "";
        } else {
            const [word, tail] = splitFirstWord(rest);
            token = word;
            rest = tail;
        }

        if (!token) {
            if (opt.required) {
                return { error: `Missing required option \`${opt.name}\`. Usage: ${usageLine(prefix, json.name, subcommandGroup, subcommand, leaf)}` };
            }
            values.set(opt.name, null);
            continue;
        }

        const resolved = await resolveOptionValue(message, opt, token);
        if (resolved === undefined) {
            return {
                error: `Couldn't understand \`${opt.name}\`: \`${token}\`. Usage: ${usageLine(prefix, json.name, subcommandGroup, subcommand, leaf)}`,
            };
        }
        values.set(opt.name, resolved);
    }

    return { interaction: buildFakeInteraction(message, client, json.name, subcommandGroup, subcommand, values) };
}
