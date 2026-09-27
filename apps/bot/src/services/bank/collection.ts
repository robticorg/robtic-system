import { Collection } from "discord.js-selfbot-v13";
import type { Workflow } from "./type";

const workflows = new Collection<string, Workflow>();
const workflowMessages = new Collection<string, string>();

export { workflows, workflowMessages };