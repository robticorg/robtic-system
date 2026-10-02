import { Logger } from "@logger";
import { client } from "../client";
import { startTransfer } from "../transfer";

const CTX = "bank-api";
const SNOWFLAKE = /^\d{17,20}$/;
const AMOUNT = /^[1-9]\d{0,15}$/;

const STATUS_FOR_REASON = {
    ACTIVE_WORKFLOW: 409,
    GUILD_NOT_FOUND: 404,
    CHANNEL_NOT_FOUND: 404,
} as const;

const json = (status: number, body: Record<string, unknown>) => Response.json(body, { status });

export interface TransferRequest {
    guildId: string;
    channelId: string;
    userId: string;
    amount: string;
}

export function parseTransferRequest(body: unknown): { transfer: TransferRequest } | { error: string } {
    if (typeof body !== "object" || body === null) return { error: "body must be a JSON object" };
    const { guildId, channelId, userId, amount } = body as Record<string, unknown>;

    for (const [name, value] of Object.entries({ guildId, channelId, userId })) {
        if (typeof value !== "string" || !SNOWFLAKE.test(value)) return { error: `${name} must be a Discord ID (string of digits)` };
    }

    const amountText = typeof amount === "number" && Number.isSafeInteger(amount) ? String(amount) : amount;
    if (typeof amountText !== "string" || !AMOUNT.test(amountText)) return { error: "amount must be a positive whole number" };

    return { transfer: { guildId: guildId as string, channelId: channelId as string, userId: userId as string, amount: amountText } };
}

async function handleTransfer(request: Request): Promise<Response> {
    const body = await request.json().catch(() => null);
    const parsed = parseTransferRequest(body);
    if ("error" in parsed) return json(400, { success: false, error: parsed.error });

    if (!client.isReady()) return json(503, { success: false, error: "bank bot is not logged in" });

    try {
        const result = await startTransfer(parsed.transfer);
        if (!result.success) {
            return json(STATUS_FOR_REASON[result.reason], { success: false, error: result.reason });
        }

        const { userId, guildId, channelId, amount } = parsed.transfer;
        Logger.info(`Transfer started: ${amount} to ${userId} in ${guildId}/${channelId}`, CTX);
        return json(200, {
            success: true,
            transferMessageId: result.workflow.transferMessageId,
            step: result.workflow.step,
        });
    } catch (err) {
        Logger.warn(`Transfer failed to start: ${err}`, CTX);
        return json(502, { success: false, error: "could not send the transfer command" });
    }
}

export function startBankApi(): void {
    const hostname = process.env.BANK_API_HOST?.trim() || "0.0.0.0";
    const port = Number(process.env.BANK_API_PORT) || 8790;

    Bun.serve({
        hostname,
        port,
        routes: {
            "/health": { GET: () => json(200, { success: true, bankReady: client.isReady() }) },
            "/transfer": { POST: request => handleTransfer(request) },
        },
        fetch: () => json(404, { success: false, error: "not found" }),
    });

    Logger.success(`Bank API listening on http://${hostname}:${port}`, CTX);
}
