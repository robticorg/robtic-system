/**
 * The feature's window onto shared domain logic.
 *
 * `@core/robs` stays in libs so other apps can read the same balance; libs can never
 * import apps.
 */
export { getRobsBalance, type RobsBalance } from "@core/robs";
