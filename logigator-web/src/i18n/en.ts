const en = {
  /**
   * `@logigator/ui`'s stock strings, wired up through `provideLgLabels`, so
   * every surface the library renders is localized without its call site
   * passing a label.
   */
  common: {
    close: 'Close',
    back: 'Back',
    dismiss: 'Dismiss',
    firstPage: 'First page',
    previousPage: 'Previous page',
    nextPage: 'Next page',
    lastPage: 'Last page'
  },
  site: {
    name: 'Logigator',
    description:
      'Build and simulate your own logic circuits with Logigator, a simple yet powerful web-based online tool.'
  },
  header: {
    home: 'Logigator home',
    features: 'Features',
    community: 'Community',
    myProjects: 'My Projects',
    myComponents: 'My Components',
    login: 'Login',
    register: 'Sign up',
    account: 'Account',
    logout: 'Logout',
    openNavigation: 'Open navigation',
    navigation: 'Navigation',
    settings: 'Settings',
    userMenu: 'Account menu',
    language: 'Language',
    darkMode: 'Dark Mode',
    skipToContent: 'Skip to content'
  },
  footer: {
    privacyPolicy: 'Data Policy',
    imprint: 'Imprint',
    contributing: 'Contributing'
  },
  pages: {
    home: {
      title: 'Build and Simulate Logic Circuits',
      lead: 'Build, simulate and manage complex logic circuits for free.',
      openEditor: 'Open the editor'
    },
    notFound: {
      title: 'Page not found',
      text: 'The requested page could not be found.',
      back: 'Back to home'
    }
  }
  // Only this file is `as const`: it is the schema every other locale is
  // checked against, and its literal message text is what `TranslateArgs` reads
  // a key's `{{placeholder}}` names from.
} as const;

export default en;
