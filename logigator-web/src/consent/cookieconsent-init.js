// The origin-wide cookie-consent bootstrap, bundled behind the library into
// `/js/cookieconsent.js`. One config, one stylesheet and one consent cookie for
// the site and the editor alike — the editor injects this exact URL at startup
// and reads nothing else about consent.

(function () {
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/cookieconsent.css';
  document.head.appendChild(link);

  // Both hosts mark dark mode with `dark-mode` on <html>: the site's server
  // render puts it in the first byte, the editor applies it before it paints.
  // The editor can also switch at runtime, hence the observer.
  function syncTheme() {
    document.documentElement.classList.toggle(
      'cc--darkmode',
      document.documentElement.classList.contains('dark-mode')
    );
  }

  syncTheme();
  new MutationObserver(syncTheme).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  });

  // The languages this bundle ships, and the one list a language read from the
  // cookie is checked against: a default the library holds no translation for
  // makes `run()` reject, which leaves the banner unrendered, the consented
  // scripts uninserted and consent itself impossible to change.
  var TRANSLATIONS = {
    en: '/cookieconsent/en.json',
    de: '/cookieconsent/de.json',
    es: '/cookieconsent/es.json',
    fr: '/cookieconsent/fr.json'
  };

  // The language lives in the origin-wide `preferences` cookie, which both
  // hosts write. Falling through to the library's browser detection covers a
  // first visit, where the cookie does not exist yet.
  function preferredLanguage() {
    var match = document.cookie.match(/(?:^|;\s*)preferences=([^;]*)/);
    if (!match) {
      return null;
    }
    try {
      var lang = JSON.parse(
        decodeURIComponent(match[1]).replace(/^j:/, '')
      ).lang;
      // `hasOwnProperty` rather than a lookup: a cookie naming `constructor`
      // passes a truthiness test and reaches the library anyway.
      return Object.prototype.hasOwnProperty.call(TRANSLATIONS, lang)
        ? lang
        : null;
    } catch (e) {
      // Client-writable and shared with two other stacks; a malformed value
      // just means no preference.
      return null;
    }
  }

  var lang = preferredLanguage();

  // eslint-disable-next-line no-undef
  CookieConsent.run({
    language: {
      default: lang || 'en',
      autoDetect: lang ? undefined : 'browser',
      translations: TRANSLATIONS
    },
    categories: {
      necessary: {
        enabled: true,
        readOnly: true
      },
      analytics: {}
    },
    cookie: {
      expiresAfterDays: 365
    },
    guiOptions: {
      consentModal: {
        layout: 'bar',
        equalWeightButtons: false
      },
      preferencesModal: {
        equalWeightButtons: false
      }
    }
  });
})();
