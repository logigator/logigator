import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

const AppTheme = definePreset(Aura, {
  components: {
    paginator: {
      navButton: {
        borderRadius: '{borderRadiusMd}'
      }
    },
    tooltip: {
      colorScheme: {
        light: {
          root: {
            background: '{content.background}',
            color: '{text.color}'
          }
        }
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
          },
          info: {
            color: '{blue.600}',
            background: 'color-mix(in srgb, {blue.50}, transparent 5%)',
            borderColor: '{blue.200}'
          },
          success: {
            color: '{green.600}',
            background: 'color-mix(in srgb, {green.50}, transparent 5%)',
            borderColor: '{green.200}'
          },
          warn: {
            color: '{yellow.600}',
            background: 'color-mix(in srgb, {yellow.50}, transparent 5%)',
            borderColor: '{yellow.200}'
          },
          error: {
            color: '{red.600}',
            background: 'color-mix(in srgb, {red.50}, transparent 5%)',
            borderColor: '{red.200}'
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
          },
          info: {
            color: '{blue.500}',
            background: 'color-mix(in srgb, {blue.500}, transparent 84%)',
            borderColor: 'color-mix(in srgb, {blue.700}, transparent 64%)'
          },
          success: {
            color: '{green.500}',
            background: 'color-mix(in srgb, {green.500}, transparent 84%)',
            borderColor: 'color-mix(in srgb, {green.700}, transparent 64%)'
          },
          warn: {
            color: '{yellow.500}',
            background: 'color-mix(in srgb, {yellow.500}, transparent 84%)',
            borderColor: 'color-mix(in srgb, {yellow.700}, transparent 64%)'
          },
          error: {
            color: '{red.500}',
            background: 'color-mix(in srgb, {red.500}, transparent 84%)',
            borderColor: 'color-mix(in srgb, {red.700}, transparent 64%)'
          }
        }
      }
    }
  }
});

export { AppTheme };
