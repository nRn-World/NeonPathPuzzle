import React from 'react';
import { NeonTheme } from '../types';

interface ThemeDemoProps {
  theme: NeonTheme;
}

const ThemeDemo: React.FC<ThemeDemoProps> = ({ theme }) => {
  const getThemeScreenshot = (theme: NeonTheme): string => {
    switch (theme) {
      case 'cyberpunk':
        return '/screenshots/themes/cyberpunk.png';
      case 'retro-wave':
        return '/screenshots/themes/retro-wave.png';
      case 'cosmic':
        return '/screenshots/themes/cosmic.png';
      case 'matrix':
        return '/screenshots/themes/matrix.png';
      case 'neon-sunset':
        return '/screenshots/themes/neon-sunset.png';
      case 'spring':
        return '/screenshots/themes/spring.png';
      case 'summer':
        return '/screenshots/themes/summer.png';
      case 'halloween':
        return '/screenshots/themes/halloween.png';
      case 'winter':
        return '/screenshots/themes/winter.png';
      default:
        return '/screenshots/themes/default.png';
    }
  };

  return (
    <div className="theme-demo">
      <img
        src={getThemeScreenshot(theme)}
        alt={`${theme} theme`}
        className="theme-screenshot"
      />
    </div>
  );
};

export default ThemeDemo;
