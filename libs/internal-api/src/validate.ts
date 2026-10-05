import { ApiError } from "@sdk";

const SNOWFLAKE = /^\d{17,20}$/;

/** A Discord id from a path/query value, or a 400 naming the field. */
export function requireSnowflake(value: string | null | undefined, field: string): string {
    if (!value || !SNOWFLAKE.test(value)) throw ApiError.validation({ [field]: "must be a Discord ID" });
    return value;
}

/** An optional whole number within `[min, max]` from a query value, or a 400 naming the field. */
export function optionalInt(value: string | null, field: string, fallback: number, min: number, max: number): number {
    if (value === null || value === "") return fallback;
    const n = Number(value);
    if (!Number.isInteger(n) || n < min || n > max) throw ApiError.validation({ [field]: `must be a whole number from ${min} to ${max}` });
    return n;
}
