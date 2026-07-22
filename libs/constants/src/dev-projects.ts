/** Accent color for project container components. */
export const PROJECT_ACCENT_COLOR = 0x0099ff;

/** Projects listed per page in the dev project browser. */
export const PROJECT_PAGE_SIZE = 10;

/** Maximum options a Discord select menu accepts. */
export const PROJECT_SELECT_MAX_OPTIONS = 25;

/** Discord's hard limits for select-menu option lists. */
export const SELECT_MENU_MAX_OPTIONS = 25;
export const SELECT_MENU_LABEL_MAX_LENGTH = 100;

/** Ranking weights for the "Top Projects" feature list. */
export const PROJECT_SCORE_WEIGHTS = {
    like: 5,
    view: 1,
    dislike: -3,
} as const;

/** How many projects are featured at the top of a browser page. */
export const PROJECT_TOP_COUNT = 3;

/** Truncation limits for project text rendered inside select menus and panels. */
export const PROJECT_TRUNCATE = {
    default: 100,
    title: 80,
    description: 120,
} as const;

/** Project types a member may pick when sharing. */
export const PROJECT_TYPE_OPTIONS = ["web", "discord", "other"] as const;

/** Character limits for the project-sharing modal inputs. */
export const PROJECT_INPUT_LIMITS = {
    shortMin: 3,
    shortMax: 100,
    paragraphMin: 10,
    paragraphMax: 2000,
} as const;

/** Length of the generated public project id. */
export const PROJECT_ID_LENGTH = 8;
