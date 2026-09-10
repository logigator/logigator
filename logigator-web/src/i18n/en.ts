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
    docs: 'Documentation',
    examples: 'Examples',
    community: 'Community',
    myProjects: 'My Projects',
    myComponents: 'My Components',
    login: 'Login',
    register: 'Sign up',
    account: 'Account',
    logout: 'Logout',
    openNavigation: 'Open navigation',
    navigation: 'Navigation',
    userMenu: 'Account menu',
    notSignedIn: 'Not signed in',
    theme: 'Theme',
    themeLight: 'Light',
    themeDark: 'Dark',
    language: 'Language',
    skipToContent: 'Skip to content'
  },
  footer: {
    changelog: 'Changelog',
    privacyPolicy: 'Privacy Policy',
    imprint: 'Imprint',
    contributing: 'Contributing'
  },
  documents: {
    /** Read after the count, so a screen reader says “214 stars”. */
    stars: 'stars'
  },
  errors: {
    retry: 'Retry'
  },
  forms: {
    errors: {
      required: 'This field is required.',
      invalid: 'This value was not accepted.',
      emailInvalid: 'Enter a valid email address.',
      usernameTooShort: 'Use at least 2 characters.',
      usernameTooLong: 'Use at most 20 characters.',
      usernamePattern: 'Use letters, digits, “_” and “-” only.',
      passwordTooShort: 'Use at least 8 characters.',
      passwordTooLong: 'Use at most 200 characters.',
      passwordComplexity: 'Use at least one letter and one digit.',
      passwordMismatch: 'The two passwords do not match.',
      rateLimited: 'Too many attempts. Please wait a moment and try again.',
      serviceUnavailable:
        'The service is temporarily unavailable. Please try again in a moment.',
      validationFailed: 'Please check your entries and try again.',
      network: 'No connection to the server. Check your network and try again.',
      unknown: 'Something went wrong. Please try again.'
    }
  },
  auth: {
    email: 'Email',
    password: 'Password',
    passwordRepeat: 'Repeat password',
    passwordRules: 'At least 8 characters, with a letter and a digit.',
    username: 'Username',
    or: 'or',
    continueWithGoogle: 'Continue with Google',
    googleErrors: {
      failed: 'Signing in with Google did not work. Please try again.',
      stateInvalid: 'That sign-in attempt expired. Please start again.',
      emailTaken:
        'An account already uses that email address. Sign in with your password, then link Google from your account.',
      alreadyLinked: 'That Google account belongs to another Logigator account.'
    }
  },
  pages: {
    login: {
      title: 'Login',
      heading: 'Welcome back',
      submit: 'Log in',
      forgotPassword: 'Forgot your password?',
      noAccount: 'No account yet?',
      registerLink: 'Sign up',
      invalidCredentials: 'Email or password is incorrect.',
      notVerified: 'Confirm your email address before signing in.',
      resend: 'Send the confirmation mail again',
      resent: 'Confirmation mail sent. Check your inbox.'
    },
    register: {
      title: 'Sign up',
      heading: 'Create your account',
      submit: 'Sign up',
      emailTaken: 'That email address already has an account.',
      mailFailed:
        'Your account was created, but the confirmation mail could not be sent. Sign in to have it sent again.',
      privacyNoticeBefore: 'By signing up you confirm that you have read our ',
      privacyNoticeLink: 'privacy policy',
      privacyNoticeAfter: ' and accept it.',
      haveAccount: 'Already have an account?',
      loginLink: 'Log in',
      confirmHeading: 'Confirm your email address',
      confirmLead:
        'We sent a confirmation link to {{email}}. Open it to finish signing up.',
      toLogin: 'Go to login'
    },
    resetPassword: {
      title: 'Reset password',
      requestHeading: 'Reset your password',
      requestLead:
        'Enter the address you signed up with and we will send you a link.',
      requestSubmit: 'Send reset link',
      requestSent:
        'If that address has an account, a reset link is on its way. The link is valid for one hour.',
      backToLogin: 'Back to login',
      applyHeading: 'Choose a new password',
      applySubmit: 'Save new password',
      applied: 'Your password was changed. You can sign in now.',
      tokenInvalid: 'This link is no longer valid. Please request a new one.',
      requestNew: 'Request a new link'
    },
    verifyEmail: {
      title: 'Email confirmation',
      pending: 'Confirming your email address',
      pendingLead: 'One moment please.',
      success: 'Your email address is confirmed',
      successLead: 'You can sign in now.',
      error: 'This link did not work',
      errorLead:
        'Confirmation links expire after an hour. You can have a new one sent from the login page.',
      toLogin: 'Go to login'
    },
    home: {
      title: 'Build and Simulate Logic Circuits',
      hero: {
        headline: 'Build, simulate and manage complex logic circuits for free.',
        lede: 'Gates, wires and reusable subcircuits, in the browser. The simulation runs on a WebAssembly engine and the board renders on the GPU, so a circuit keeps stepping as it grows.',
        cta: 'Start Building Now',
        ctaSecondary: 'Browse examples'
      },
      features: {
        title: 'Features',
        description:
          'Build and simulate your own circuits with Logigator, a simple yet powerful online tool.',
        performance: {
          title: 'Performance',
          body: "Logigators' editor can handle even the largest projects with ease thanks to WebAssembly and WebGL."
        },
        subcircuits: {
          title: 'Subcircuits',
          body: 'Create subcircuits and use them all over your projects to help keep them organized.'
        },
        share: {
          title: 'Share Projects',
          body: 'Share your circuits with other users, so they can learn from your work.'
        },
        images: {
          title: 'Export Images',
          body: 'With Logigator you can export high resolution images in three different formats (SVG, PNG, JPG) to use them anywhere.'
        }
      },
      examples: {
        title: 'Example Circuits',
        description:
          'Learn to design simple and more complex circuits from our examples.',
        more: 'See More Examples',
        emptyHeading: 'No examples yet',
        emptyBody: 'Nothing has been published for this deployment.',
        failed: 'Examples could not be loaded'
      },
      video: {
        title: 'What are logic circuits?',
        description:
          "If you don't know what logic gates or logic circuits are, we animated a short explanation for you to watch.",
        play: 'Play the video “{{title}}” on YouTube'
      },
      community: {
        projectsTitle: 'Community Projects',
        projectsDescription:
          'Explore other projects created by our community. Your Project could be the next on this list.',
        moreProjects: 'See More Projects',
        projectsEmptyHeading: 'No public projects yet',
        projectsEmptyBody: 'Nothing has been shared with the community so far.',
        projectsFailed: 'Projects could not be loaded',
        componentsTitle: 'Community Components',
        componentsDescription:
          'Explore other components created by our community. They may be useful for you.',
        moreComponents: 'See More Components',
        componentsEmptyHeading: 'No public components yet',
        componentsEmptyBody:
          'Nothing has been shared with the community so far.',
        componentsFailed: 'Components could not be loaded'
      }
    },
    examples: {
      // One string for the <title> and the h1: the page is named the same
      // thing in the tab and on the page itself.
      title: 'Example Circuits',
      lede: 'Learn to design simple and more complex circuits from our examples. Every one of them opens in the editor, ready to run.',
      open: 'Open in editor',
      openNamed: 'Open “{{name}}” in the editor',
      emptyHeading: 'No examples yet',
      emptyBody: 'Nothing has been published for this deployment.',
      failed: 'Examples could not be loaded'
    },
    docs: {
      title: 'Documentation',
      lede: 'Every part of the Logigator editor, explained: the board and its tools, building circuits, running a simulation, and keeping your work.',
      search: {
        label: 'Search the documentation',
        placeholder: 'Search..',
        empty: 'Nothing matches “{{query}}”.'
      },
      navLabel: 'Documentation pages',
      allTopics: 'All topics',
      sections: {
        basics: 'Basics',
        building: 'Building Circuits',
        simulation: 'Simulation',
        projects: 'Projects & Cloud'
      },
      pages: {
        gettingStarted: 'Getting Started',
        boardAndTools: 'Board & Tools',
        shortcuts: 'Keyboard Shortcuts',
        settings: 'Settings & Appearance',
        componentsAndOptions: 'Components & Options',
        wiresAndConnections: 'Wires & Connections',
        customComponents: 'Custom Components',
        simulation: 'Simulation',
        inspection: 'Inspection & Watches',
        savingAndFiles: 'Saving & Files',
        cloud: 'Cloud & Sharing'
      }
    },
    changelog: {
      title: 'Changelog',
      lede: 'Every release of the Logigator editor, newest first: what was added, what changed, and what was fixed.',
      feed: 'Subscribe via Atom'
    },
    imprint: {
      title: 'Imprint',
      lede: 'Who runs Logigator, and how to reach us.'
    },
    privacyPolicy: {
      title: 'Privacy Policy',
      lede: 'Which data Logigator processes, why it is processed, and what rights you have over it.'
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
