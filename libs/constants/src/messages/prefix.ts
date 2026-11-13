import { bilingual } from "@utils/lang-context";

/** Replies produced by the prefix-command router and argument parser. */
export const PREFIX_MESSAGES = bilingual({
    modalOnlyCommand: (commandName: string) => `\`${commandName}\` needs its form: use \`/${commandName}\` instead.`,
    modalOnlySubcommand: (commandName: string, subcommand: string) =>
        `\`${commandName} ${subcommand}\` needs its form: use \`/${commandName} ${subcommand}\` instead. ` +
        "The command's other parts still work from chat.",
    unknownSubcommand: (expectedNames: string) => `Missing or unknown subcommand. Expected one of: ${expectedNames}`,
    unknownSubcommandInGroup: (group: string, expectedNames: string) => `Missing or unknown subcommand in "${group}". Expected one of: ${expectedNames}`,
    missingRequiredOption: (optionName: string, usage: string) => `Missing \`${optionName}\`. Usage: ${usage}`,
    invalidOptionValue: (optionName: string, token: string, usage: string) => `Couldn't understand \`${optionName}\`: \`${token}\`. Usage: ${usage}`,
    missingOption: (optionName: string) => `Missing option "${optionName}"`,
    noSubcommand: "No subcommand given",
    noSubcommandGroup: "No subcommand group given",
}, {
    modalOnlyCommand: (commandName: string) => `\`${commandName}\` يحتاج نموذج: استخدم \`/${commandName}\` بدلاً منه.`,
    modalOnlySubcommand: (commandName: string, subcommand: string) =>
        `\`${commandName} ${subcommand}\` يحتاج نموذج: استخدم \`/${commandName} ${subcommand}\` بدلاً منه. ` +
        "باقي أجزاء الأمر تشتغل من الشات عادي.",
    unknownSubcommand: (expectedNames: string) => `أمر فرعي ناقص أو غير معروف. المتاح: ${expectedNames}`,
    unknownSubcommandInGroup: (group: string, expectedNames: string) => `أمر فرعي ناقص أو غير معروف في "${group}". المتاح: ${expectedNames}`,
    missingRequiredOption: (optionName: string, usage: string) => `ناقص \`${optionName}\`. الاستخدام: ${usage}`,
    invalidOptionValue: (optionName: string, token: string, usage: string) => `ما فهمت \`${optionName}\`: \`${token}\`. الاستخدام: ${usage}`,
    missingOption: (optionName: string) => `ناقص الخيار "${optionName}"`,
    noSubcommand: "ما حددت أمر فرعي",
    noSubcommandGroup: "ما حددت مجموعة الأمر",
});

/** How long a prefix usage/validation notice (and the mistyped trigger message) stays before auto-deletion. */
export const PREFIX_USAGE_DELETE_MS = 5_000;
