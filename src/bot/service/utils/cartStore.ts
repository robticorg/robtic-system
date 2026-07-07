import type { AdSection } from "@database/models/AdsConfig";

export interface CartItem {
    section: AdSection;
    key: string;
    name: string;
    priceUsd: number;
}

const carts = new Map<string, CartItem[]>();

export function getCart(userId: string): CartItem[] {
    return carts.get(userId) ?? [];
}

export function addToCart(userId: string, item: CartItem): CartItem[] {
    const cart = carts.get(userId) ?? [];
    cart.push(item);
    carts.set(userId, cart);
    return cart;
}

export function clearCart(userId: string): void {
    carts.delete(userId);
}

export function removeFromCart(userId: string, index: number): CartItem[] {
    const cart = carts.get(userId) ?? [];
    cart.splice(index, 1);
    carts.set(userId, cart);
    return cart;
}

export function cartTotalUsd(items: CartItem[]): number {
    return items.reduce((sum, i) => sum + i.priceUsd, 0);
}
