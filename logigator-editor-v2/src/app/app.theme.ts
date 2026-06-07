import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

const AppTheme = definePreset(Aura, {
  components: {
    paginator: {
      navButton: {
        borderRadius: '{borderRadiusMd}'
      }
    }
  },
  semantic: {
    colorScheme: {
      light: {
        semantic: {
          primary: {
            50: '#BBF0D2',
            100: '#A2EAC1',
            200: '#70DF9F',
            300: '#3ED47D',
            400: '#27AE60',
            500: '#209150',
            600: '#1A7440',
            700: '#135730',
            800: '#0D3920',
            900: '#061C10',
            950: '#030E08'
          }
        }
      },
      dark: {
        semantic: {
          primary: {
            50: '#BBF0D2',
            100: '#A2EAC1',
            200: '#70DF9F',
            300: '#3ED47D',
            400: '#27AE60',
            500: '#209150',
            600: '#1A7440',
            700: '#135730',
            800: '#0D3920',
            900: '#061C10',
            950: '#030E08'
          }
        }
      }
    }
  }
});

export { AppTheme };
