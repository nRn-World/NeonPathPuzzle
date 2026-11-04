import { create } from "zustand";
import { persist } from "zustand/middleware";

interface HintTokenState {
  tokens: number;
  spent: number;
  earned: number;
  addTokens: (amount?: number) => void;
  spendToken: () => boolean;
  spendTokens: (amount: number) => boolean;
}

export const useHintTokenStore = create<HintTokenState>()(
  persist(
    (set, get) => ({
      tokens: 3,
      spent: 0,
      earned: 3,
      addTokens: (amount = 1) => set(state => ({
        tokens: state.tokens + Math.max(0, Math.trunc(amount)),
        earned: state.earned + Math.max(0, Math.trunc(amount)),
      })),
      spendToken: () => get().spendTokens(1),
      spendTokens: (amount) => {
        const cost = Math.max(0, Math.trunc(amount));
        if (cost === 0) return true;
        if (get().tokens < cost) return false;
        set(state => ({ tokens: state.tokens - cost, spent: state.spent + cost }));
        return true;
      },
    }),
    {
      name: "neon-path-hint-tokens",
      merge: (persisted, current) => {
        const saved = persisted as Partial<HintTokenState>;
        return {
          ...current,
          ...saved,
          tokens: Number.isFinite(saved.tokens) ? Math.max(0, Math.trunc(saved.tokens as number)) : current.tokens,
        };
      },
    },
  ),
);

export const HINT_TOKEN_STARTING_BALANCE = 3;
