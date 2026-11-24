import { createContext, useContext, useState, ReactNode } from "react";

interface Theme {
  background: string;
  player: string;
  goal: string;
  default: string;
  [key: string]: string;
}

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const defaultTheme: Theme = {
  background: "#1a1a2e",
  player: "#4cc9f0",
  goal: "#f72585",
  default: "#ffffff",
};

const ThemeContext = createContext<ThemeContextType>({
  theme: defaultTheme,
  setTheme: () => {},
});

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(defaultTheme);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
