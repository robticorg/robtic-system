import { MessageFlags, type ButtonInteraction, type ModalSubmitInteraction } from "discord.js";
import type { ComponentHandler } from "@typings/command";
import { verifyInvoker } from "@bot/utils/interaction";
import { parseOptionalCount, type RoleFilter, type RoleKind, type RoleSort } from "@bot/utils/roles-view/roles-view";
import {
    ROLES_BUTTON_ID,
    ROLES_FIELDS,
    ROLES_FILTER_MODAL_ID,
    ROLES_SEARCH_MODAL_ID,
    buildRolesFilterModal,
    buildRolesSearchModal,
    getRolesSession,
    renderRolesPanel,
    type RolesSession,
} from "@bot/utils/roles-view/roles-panel";

const EXPIRED = "This roles panel has expired — run `roles` again.";

/** The session behind a panel id, or a reply saying it expired / isn't theirs. */
async function sessionFor(interaction: ButtonInteraction | ModalSubmitInteraction, sessionId: string): Promise<RolesSession | null> {
    const session = getRolesSession(sessionId);
    if (!session) {
        await interaction.reply({ content: EXPIRED, flags: MessageFlags.Ephemeral }).catch(() => null);
        return null;
    }
    return (await verifyInvoker(interaction, session.invokerId)) ? session : null;
}

/** ◀ ▶ page, 🔍 search, ⚙️ filter, reset. */
const rolesButtons: ComponentHandler<ButtonInteraction> = {
    customId: ROLES_BUTTON_ID,

    async run(interaction: ButtonInteraction) {
        const [, sessionId, action] = interaction.customId.split(":");
        const session = await sessionFor(interaction, sessionId!);
        if (!session) return;

        if (action === "search") return void await interaction.showModal(buildRolesSearchModal(session));
        if (action === "filter") return void await interaction.showModal(buildRolesFilterModal(session));

        if (action === "prev") session.page -= 1;
        if (action === "next") session.page += 1;
        if (action === "reset") {
            session.filter = {};
            session.page = 0;
        }
        await interaction.update(renderRolesPanel(session));
    },
};

const rolesSearch: ComponentHandler<ModalSubmitInteraction> = {
    customId: ROLES_SEARCH_MODAL_ID,

    async run(interaction: ModalSubmitInteraction) {
        const session = await sessionFor(interaction, interaction.customId.split(":")[1]!);
        if (!session) return;

        const query = interaction.fields.getTextInputValue(ROLES_FIELDS.query).trim();
        session.filter = { ...session.filter, query: query || undefined };
        session.page = 0;
        await updatePanel(interaction, session);
    },
};

const KINDS: ReadonlySet<string> = new Set<RoleKind | "anyStaff">(["anyStaff", "owner", "high", "staff", "ship", "bot", "booster", "member"]);
const SORTS: ReadonlySet<string> = new Set<RoleSort>(["position", "order", "members"]);

const rolesFilter: ComponentHandler<ModalSubmitInteraction> = {
    customId: ROLES_FILTER_MODAL_ID,

    async run(interaction: ModalSubmitInteraction) {
        const session = await sessionFor(interaction, interaction.customId.split(":")[1]!);
        if (!session) return;

        const select = (id: string) => {
            try { return [...interaction.fields.getStringSelectValues(id)]; } catch { return []; }
        };
        const orderMin = parseOptionalCount(interaction.fields.getTextInputValue(ROLES_FIELDS.orderMin));
        const orderMax = parseOptionalCount(interaction.fields.getTextInputValue(ROLES_FIELDS.orderMax));
        const minMembers = parseOptionalCount(interaction.fields.getTextInputValue(ROLES_FIELDS.minMembers));

        if (orderMin === null || orderMax === null || minMembers === null) {
            await interaction.reply({ content: "Order and members must be whole numbers (or left empty).", flags: MessageFlags.Ephemeral });
            return;
        }

        const sort = select(ROLES_FIELDS.sort)[0];
        const filter: RoleFilter = {
            query: session.filter.query,
            kinds: select(ROLES_FIELDS.kinds).filter(k => KINDS.has(k)) as RoleFilter["kinds"],
            orderMin,
            orderMax,
            minMembers,
            sort: sort && SORTS.has(sort) ? sort as RoleSort : undefined,
        };
        session.filter = filter;
        session.page = 0;
        await updatePanel(interaction, session);
    },
};

/** A modal opened from the panel's button edits that same panel message. */
async function updatePanel(interaction: ModalSubmitInteraction, session: RolesSession): Promise<void> {
    if (interaction.isFromMessage()) await interaction.update(renderRolesPanel(session));
    else await interaction.reply({ ...renderRolesPanel(session), flags: MessageFlags.Ephemeral });
}

export default [rolesButtons, rolesSearch, rolesFilter];
