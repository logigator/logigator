import accountMenu from '@assets/docs/images/account-menu.png';
import boardOverview from '@assets/docs/images/board-overview.png';
import componentPalette from '@assets/docs/images/component-palette.png';
import componentSettings from '@assets/docs/images/component-settings.png';
import customComponentShowcase from '@assets/docs/images/custom-component-showcase.png';
import customComponentTab from '@assets/docs/images/custom-component-tab.png';
import exportImage from '@assets/docs/images/export-image.png';
import inspectionShowcase from '@assets/docs/images/inspection-showcase.png';
import inspectionWindowMultilayer from '@assets/docs/images/inspection-window-multilayer.png';
import introBanner from '@assets/docs/images/intro-banner.png';
import menuBar from '@assets/docs/images/menu-bar.png';
import negatedGate from '@assets/docs/images/negated-gate.png';
import openCloud from '@assets/docs/images/open-cloud.png';
import openFile from '@assets/docs/images/open-file.png';
import romInspection from '@assets/docs/images/rom-inspection.gif';
import scissorSelect from '@assets/docs/images/scissor-select.png';
import shareComponent from '@assets/docs/images/share-component.png';
import shortcutManager from '@assets/docs/images/shortcut-manager.png';
import simulationControls from '@assets/docs/images/simulation-controls.png';
import simulationShowcase from '@assets/docs/images/simulation-showcase.gif';
import toolButtons from '@assets/docs/images/tool-buttons.png';
import tunnel from '@assets/docs/images/tunnel.png';
import uploadToCloud from '@assets/docs/images/upload-to-cloud.png';
import wireCircuitDisplay from '@assets/docs/images/wire-circuit-display.png';
import wireJunction from '@assets/docs/images/wire-junction.png';

/**
 * Documentation screenshots, keyed by the destination string authored in the
 * page markdown (`../images/…`, relative to the page's folder). Each import
 * resolves to the build's cache-busted URL for that file — the image file
 * loader, the same scheme the page markdown in `DOC_SECTIONS` uses — so
 * rendering swaps the authored destination for the hashed URL. Screenshots are
 * shared by all languages: adding one = drop the file under
 * `src/assets/docs/images/`, import it, and register it here under the
 * destination the markdown uses.
 */
export const DOC_IMAGES: Readonly<Record<string, string>> = {
  '../images/account-menu.png': accountMenu,
  '../images/board-overview.png': boardOverview,
  '../images/component-palette.png': componentPalette,
  '../images/component-settings.png': componentSettings,
  '../images/custom-component-showcase.png': customComponentShowcase,
  '../images/custom-component-tab.png': customComponentTab,
  '../images/export-image.png': exportImage,
  '../images/inspection-showcase.png': inspectionShowcase,
  '../images/inspection-window-multilayer.png': inspectionWindowMultilayer,
  '../images/intro-banner.png': introBanner,
  '../images/menu-bar.png': menuBar,
  '../images/negated-gate.png': negatedGate,
  '../images/open-cloud.png': openCloud,
  '../images/open-file.png': openFile,
  '../images/rom-inspection.gif': romInspection,
  '../images/scissor-select.png': scissorSelect,
  '../images/share-component.png': shareComponent,
  '../images/shortcut-manager.png': shortcutManager,
  '../images/simulation-controls.png': simulationControls,
  '../images/simulation-showcase.gif': simulationShowcase,
  '../images/tool-buttons.png': toolButtons,
  '../images/tunnel.png': tunnel,
  '../images/upload-to-cloud.png': uploadToCloud,
  '../images/wire-circuit-display.png': wireCircuitDisplay,
  '../images/wire-junction.png': wireJunction
};
