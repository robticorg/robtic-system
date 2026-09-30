/** Verifies the boost thank-you wording and manifest — no database, no gateway. */
import { boostThanksMessage } from "@bot/features/boost/utils/boost-message";
import { boostFeature } from "@bot/features/boost/boost";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
    if (!ok) failures++;
};

{
    const emoji = "<:CrystalSub:123456789012345678>";
    const [mention, arabic, english] = boostThanksMessage("42", emoji).split("\n");
    check("mentions the booster first", mention === "<@42>");
    check("Arabic line is bold and ends with the emoji",
        arabic === `**شكراً لدعمك لروبيتك وتعزيزك للسيرفر، دعمك يعني لنا الكثير ويساعدنا على الاستمرار والتطور ${emoji}**`, arabic);
    check("English line is small text and ends with the emoji",
        english === `-# Thank you for supporting Robtic and boosting the server, your support means a lot and helps us keep growing ${emoji}`, english);

    const bare = boostThanksMessage("42", "");
    check("without the emoji there is no trailing space", !/ \*\*$/.test(bare.split("\n")[1]!) && !bare.endsWith(" "));
}

{
    const command = boostFeature.commands[0];
    check("/boost channel exists", command.name === "boost" && command.subcommands.some(s => s.name === "channel"));
    check("/boost is admin-only", command.access === "admin");
    check("the channel is optional, so it can be cleared", command.subcommands[0].options.every(o => !("required" in o) || !o.required));
}

if (failures > 0) {
    console.log(`\n${failures} check(s) failed.`);
    process.exit(1);
}

console.log("\nAll boost checks passed.");
