import { inject, Injectable } from '@angular/core';
import { RendererType, type Renderer, type WebGLRenderer } from 'pixi.js';
import { RendererService } from '../rendering/renderer.service';
import { WorkModeService } from '../work-mode/work-mode.service';
import { SimulationService } from '../simulation/simulation.service';
import { LayoutService } from '../layout/layout.service';
import type { ReportClientInfo } from '../api/models/report-error';

/**
 * Gathers a snapshot of the client environment for a bug report: browser/OS
 * parsed from the user agent, the live rendering backend, GPU string, window
 * and screen geometry, locale, current route, and the editor's interaction
 * state. Every field is best-effort — a failing probe is simply omitted rather
 * than allowed to break the report.
 */
@Injectable({ providedIn: 'root' })
export class ClientInfoService {
  private readonly rendererService = inject(RendererService);
  private readonly workMode = inject(WorkModeService);
  private readonly simulation = inject(SimulationService);
  private readonly layout = inject(LayoutService);

  public collect(): ReportClientInfo {
    const renderer = this.rendererService.renderer;
    return {
      browser: this.browser(),
      os: this.os(),
      renderingContext: renderer ? this.rendererMode(renderer) : undefined,
      gpu: this.gpu(),
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      devicePixelRatio: window.devicePixelRatio || 1,
      locale: navigator.language,
      url: window.location.href,
      workMode: String(this.workMode.mode()),
      simulationRunning: this.simulation.isRunning(),
      touch: this.layout.isTouch()
    };
  }

  /** Coarse browser name + version parsed from the user agent. */
  private browser(): string | undefined {
    const ua = navigator.userAgent;
    const patterns: [RegExp, string][] = [
      [/Edg\/([\d.]+)/, 'Edge'],
      [/OPR\/([\d.]+)/, 'Opera'],
      [/Firefox\/([\d.]+)/, 'Firefox'],
      [/Chrome\/([\d.]+)/, 'Chrome'],
      [/Version\/([\d.]+).*Safari/, 'Safari']
    ];
    for (const [pattern, name] of patterns) {
      const match = pattern.exec(ua);
      if (match) return `${name} ${match[1]}`;
    }
    return undefined;
  }

  /** Coarse operating-system name parsed from the user agent. */
  private os(): string | undefined {
    const ua = navigator.userAgent;
    if (/Windows NT 10/.test(ua)) return 'Windows 10/11';
    if (/Windows NT/.test(ua)) return 'Windows';
    if (/Android/.test(ua)) return 'Android';
    if (/(iPhone|iPad|iPod)/.test(ua)) return 'iOS';
    if (/Mac OS X/.test(ua)) return 'macOS';
    if (/Linux/.test(ua)) return 'Linux';
    return undefined;
  }

  /** Resolves which backend the live renderer is running on. */
  private rendererMode(renderer: Renderer): string {
    switch (renderer.type) {
      case RendererType.WEBGPU:
        return 'WebGPU';
      case RendererType.WEBGL: {
        const version = (renderer as WebGLRenderer).context?.webGLVersion;
        return version ? `WebGL ${version}` : 'WebGL';
      }
      case RendererType.CANVAS:
        return 'Canvas';
      default:
        return renderer.name || `Unknown (type ${renderer.type})`;
    }
  }

  /**
   * The unmasked GPU renderer string via a throwaway WebGL context. Works
   * regardless of the app's active backend, but the extension is privacy-gated
   * in some browsers — absent then.
   */
  private gpu(): string | undefined {
    try {
      const canvas = document.createElement('canvas');
      const gl =
        canvas.getContext('webgl') ??
        (canvas.getContext(
          'experimental-webgl'
        ) as WebGLRenderingContext | null);
      if (!gl) return undefined;
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      if (!info) return undefined;
      const value = gl.getParameter(info.UNMASKED_RENDERER_WEBGL);
      return typeof value === 'string' && value ? value : undefined;
    } catch {
      return undefined;
    }
  }
}
