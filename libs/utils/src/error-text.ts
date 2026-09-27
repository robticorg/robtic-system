import { SHARED_MESSAGES } from "@constants";

export const errorText = (description: string): string => `${SHARED_MESSAGES.errorPrefix} ${description}`;
